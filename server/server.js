import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import { GameStateEngine } from './gameState.js';
import { RateLimiter } from './rateLimiter.js';
import { SPIDER_NODES, SPIDER_EDGES } from './spiderGraphData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSKEY = process.env.ADMIN_KEY || 'spiderverse';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const engine = new GameStateEngine();
// High burst tokens (600) to support 200-500 phones scanning QR simultaneously from the same venue Wi-Fi / NAT
const connectionLimiter = new RateLimiter({ maxTokens: 800, refillRate: 200, maxPayloadBytes: 2048 });
const messageLimiter = new RateLimiter({ maxTokens: 25, refillRate: 10, maxPayloadBytes: 2048 });

// Connection tracking: ws -> { playerId, ip, isAlive, lastActive }
const clients = new Map();

// --- HTTP Middleware & Static File Streaming ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Cache control for static assets (instant mobile loads)
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // HTML always fresh
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); // CSS, JS cached
    }
  }
}));

// Route aliases
app.get('/stage', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'stage.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Health check endpoint for container / load balancer probes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    players: engine.players.size,
    stage: engine.stage,
    uptimeSec: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
  });
});

// Graph geometry endpoint for fast client cache
app.get('/api/spider-graph', (req, res) => {
  res.json({
    nodes: SPIDER_NODES,
    edges: SPIDER_EDGES
  });
});

// Dynamic QR code generator pointing to current host / LAN IP
app.get('/api/qr', async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const targetUrl = `${protocol}://${host}/`;
    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      color: {
        dark: '#00f0ff',
        light: '#00000000'
      },
      margin: 1
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(svg);
  } catch (err) {
    res.status(500).send('Error generating QR');
  }
});

// --- State Broadcast Engine (Throttled & Batched) ---
let broadcastPending = false;
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 60; // Max ~16 updates/sec

function requestBroadcast() {
  const now = Date.now();
  if (now - lastBroadcastTime >= BROADCAST_THROTTLE_MS) {
    executeBroadcast();
  } else if (!broadcastPending) {
    broadcastPending = true;
    setTimeout(() => {
      broadcastPending = false;
      executeBroadcast();
    }, BROADCAST_THROTTLE_MS - (now - lastBroadcastTime));
  }
}

function executeBroadcast() {
  lastBroadcastTime = Date.now();
  const baseState = engine.getBroadcastState();
  const baseJson = JSON.stringify({ type: 'STATE_UPDATE', state: baseState });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      if (meta.playerId) {
        // Player-personalized state (with their score & answer)
        const playerState = engine.getPlayerState(meta.playerId);
        ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: playerState }));
      } else {
        // Stage / Spectator state
        ws.send(baseJson);
      }
    }
  }
}

// --- Live Timer Ticker Loop (1Hz for stage/questions) ---
let timerInterval = null;
function startTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (engine.stage === 'COUNTDOWN') {
      engine.countdownSeconds--;
      if (engine.countdownSeconds <= 0) {
        engine.activateQuestion();
      }
      requestBroadcast();
    } else if (engine.stage === 'QUESTION_ACTIVE') {
      const remaining = engine.questionDurationSec * 1000 - (Date.now() - engine.questionStartTime);
      if (remaining <= 0) {
        engine.revealAnswer();
      }
      requestBroadcast();
    }
  }, 1000);
}
startTicker();

// --- WebSocket Event Handling ---
wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!connectionLimiter.isAllowed(ip)) {
    ws.close(1008, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);
  const clientMeta = {
    socketId,
    playerId: null,
    ip,
    isAlive: true,
    lastActive: Date.now()
  };
  clients.set(ws, clientMeta);

  // Ping-pong liveness detection
  ws.on('pong', () => {
    clientMeta.isAlive = true;
    clientMeta.lastActive = Date.now();
  });

  // Send immediate initial state
  ws.send(JSON.stringify({
    type: 'INIT',
    graph: { nodes: SPIDER_NODES, edges: SPIDER_EDGES },
    state: engine.getBroadcastState()
  }));

  ws.on('message', (raw) => {
    if (!messageLimiter.validatePayload(raw) || !messageLimiter.isAllowed(clientMeta.socketId)) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'RATE_LIMIT' }));
      return;
    }

    try {
      const msg = JSON.parse(raw.toString());
      clientMeta.lastActive = Date.now();

      switch (msg.type) {
        case 'JOIN': {
          const { playerId, nickname, preferredTeam } = msg;
          if (!playerId || typeof playerId !== 'string') return;

          clientMeta.playerId = playerId;
          const player = engine.registerPlayer(playerId, nickname, preferredTeam);

          ws.send(JSON.stringify({
            type: 'JOINED',
            player,
            state: engine.getPlayerState(playerId)
          }));

          requestBroadcast();
          break;
        }

        case 'SUBMIT_ANSWER': {
          if (!clientMeta.playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'UNREGISTERED' }));
            return;
          }

          const { questionId, optionIndex } = msg;
          const result = engine.submitAnswer(clientMeta.playerId, questionId, optionIndex);

          ws.send(JSON.stringify({
            type: 'ANSWER_RESULT',
            result,
            playerState: engine.getPlayerState(clientMeta.playerId)
          }));

          // Immediately broadcast progress update to stage and all players
          requestBroadcast();
          break;
        }

        case 'ADMIN_ACTION': {
          if (msg.passkey !== ADMIN_PASSKEY) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED' }));
            return;
          }

          handleAdminAction(msg.action, msg.payload, ws);
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WS parse error:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`Socket error (${ip}):`, err.message);
    clients.delete(ws);
  });
});

function handleAdminAction(action, payload, adminWs) {
  switch (action) {
    case 'START_GAME':
      engine.currentQuestionIndex = 0;
      engine.startCountdown();
      break;

    case 'NEXT_QUESTION':
      engine.nextQuestion();
      break;

    case 'REVEAL_ANSWER':
      engine.revealAnswer();
      break;

    case 'TRIGGER_VICTORY':
      engine.triggerVictory();
      break;

    case 'RESET_GAME':
      engine.reset();
      break;

    case 'UNLOCK_TIER_TEST': {
      const { teamId, tier } = payload || {};
      if (teamId && tier) {
        engine.unlockTeamTier(teamId, Number(tier));
      }
      break;
    }

    default:
      break;
  }

  requestBroadcast();
  adminWs.send(JSON.stringify({ type: 'ADMIN_OK', action }));
}

// Dead connection reaper (runs every 15 seconds)
setInterval(() => {
  for (const [ws, meta] of clients.entries()) {
    if (!meta.isAlive) {
      ws.terminate();
      clients.delete(ws);
    } else {
      meta.isAlive = false;
      ws.ping();
    }
  }
}, 15000).unref();

// Server launch with 1024 backlog queue for high-concurrency bursts
server.listen({ port: PORT, backlog: 1024 }, () => {
  console.log(`\n🕷️ ========================================`);
  console.log(`🕷️ SPIDER-VERSE FLASHMOB SERVER LIVE!`);
  console.log(`🕷️ HTTP & WebSocket running on port: ${PORT}`);
  console.log(`🕷️ Mobile Player:    http://localhost:${PORT}/`);
  console.log(`🕷️ Stage Projector:  http://localhost:${PORT}/stage`);
  console.log(`🕷️ Admin Host:       http://localhost:${PORT}/admin`);
  console.log(`🕷️ Health Check:     http://localhost:${PORT}/health`);
  console.log(`🕷️ ========================================\n`);
});

export { app, server, engine };
