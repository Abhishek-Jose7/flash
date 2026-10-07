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
const ADMIN_PASSKEY = process.env.ADMIN_KEY || (process.env.NODE_ENV === 'production' ? '' : 'spiderverse');
if (!ADMIN_PASSKEY) {
  throw new Error('ADMIN_KEY must be set in production.');
}
if (process.env.NODE_ENV === 'production' && ADMIN_PASSKEY.length < 32) {
  throw new Error('ADMIN_KEY must be at least 32 characters in production.');
}
const MAX_CONNECTIONS = Number.parseInt(process.env.MAX_CONNECTIONS || '1000', 10);
const MAX_BUFFERED_BYTES = 256 * 1024;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 2048, perMessageDeflate: false });

const engine = new GameStateEngine();
// High burst tokens (600) to support 200-500 phones scanning QR simultaneously from the same venue Wi-Fi / NAT
const connectionLimiter = new RateLimiter({ maxTokens: 800, refillRate: 200, maxPayloadBytes: 2048 });
const messageLimiter = new RateLimiter({ maxTokens: 25, refillRate: 10, maxPayloadBytes: 2048 });
const adminLoginLimiter = new RateLimiter({ maxTokens: 10, refillRate: 10 / 60, maxPayloadBytes: 8192 });

// Connection tracking: ws -> { playerId, ip, isAlive, lastActive, role }
const clients = new Map();

/**
 * Safe send — wraps ws.send in try/catch so a socket transitioning
 * to CLOSING between the readyState check and the actual send
 * doesn't throw and crash the broadcast loop or the process.
 */
function safeSend(ws, data) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      // State updates are replaceable; disconnect a client that cannot drain its
      // queue so a slow mobile connection cannot retain unbounded server memory.
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        ws.close(1013, 'SLOW_CONSUMER');
        return;
      }
      ws.send(data);
    }
  } catch (e) {
    // Socket died between check and send — silently discard.
    // The dead-connection reaper will clean it up within 15s.
  }
}

// Enable proxy trusting for Caddy, AWS ELB, and Cloudflare reverse proxies
app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));

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

// Graph geometry endpoint — cached HTTP endpoint (fetched once by stage/admin)
app.get('/api/spider-graph', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
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
        dark: '#10141B',
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

// Admin Authentication API
app.post('/api/admin/login', (req, res) => {
  if (!adminLoginLimiter.isAllowed(req.ip || req.socket.remoteAddress || 'unknown')) {
    return res.status(429).json({ success: false, message: 'Too many login attempts. Try again shortly.' });
  }
  const { username, password } = req.body || {};
  if (username === 'admin' && password === ADMIN_PASSKEY) {
    return res.json({ success: true, token: ADMIN_PASSKEY });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

// --- State Broadcast Engine (Throttled, Batched & Delta-Aware) ---
let broadcastPending = false;
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 200; // Max ~5 updates/sec (was 60ms / 16/sec)

// Pre-serialized broadcast cache — avoids re-serializing identical payloads
let lastPlayerJson = '';
let lastStateVersion = -1;
// Track whether only the timer changed (countdown/remaining) for ultra-slim tick
let lastTimerOnlyHash = '';

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

  // Build the slim player payload first.
  const playerState = engine.getPlayerBroadcast();
  const playerJson = JSON.stringify({ type: 'STATE_UPDATE', state: playerState });

  // Quick check: skip broadcast entirely if player payload is identical (no state change)
  if (playerJson === lastPlayerJson) {
    return;
  }
  lastPlayerJson = playerJson;

  // Only build the full graph payload when the host console is connected.
  let fullJson = null;
  let hasAdminClients = false;
  for (const [, meta] of clients) {
    if (meta.role === 'admin') {
      hasAdminClients = true;
      break;
    }
  }

  if (hasAdminClients) {
    const adminState = engine.getStageBroadcast();
    fullJson = JSON.stringify({ type: 'STATE_UPDATE', state: adminState });
  }

  // Single-pass broadcast with role-aware payload selection
  for (const [ws, meta] of clients.entries()) {
    if (meta.role === 'admin') {
      safeSend(ws, fullJson || playerJson);
    } else {
      safeSend(ws, playerJson);
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
    } else if (engine.stage === 'QUESTION_REVEAL') {
      const elapsed = Date.now() - engine.revealStartTime;
      if (elapsed >= (engine.revealDurationSec || 4) * 1000) {
        engine.nextQuestion();
      }
      requestBroadcast();
    }
  }, 1000);
  // The HTTP listener keeps a running server alive; do not keep a closed test
  // server process alive solely because its game ticker is still scheduled.
  timerInterval.unref();
}
startTicker();

// --- WebSocket Event Handling ---
wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (clients.size >= MAX_CONNECTIONS || !connectionLimiter.isAllowed(ip)) {
    ws.close(1008, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);

  // Detect the host console from the URL path or Referer header.
  const referer = req.headers.referer || '';
  const urlPath = req.url || '';
  const role = urlPath.includes('/admin') || referer.includes('/admin') ? 'admin' : 'player';

  const clientMeta = {
    socketId,
    playerId: null,
    ip,
    isAlive: true,
    lastActive: Date.now(),
    role
  };
  clients.set(ws, clientMeta);

  // Ping-pong liveness detection
  ws.on('pong', () => {
    clientMeta.isAlive = true;
    clientMeta.lastActive = Date.now();
  });

  // Send immediate initial state — role-aware
  if (role === 'admin') {
    // The host console gets full state + graph data.
    safeSend(ws, JSON.stringify({
      type: 'INIT',
      graph: { nodes: SPIDER_NODES, edges: SPIDER_EDGES },
      state: engine.getStageBroadcast()
    }));
  } else {
    // Players get slim state only — no graph data (they don't need node/edge arrays)
    safeSend(ws, JSON.stringify({
      type: 'INIT',
      state: engine.getPlayerBroadcast()
    }));
  }

  ws.on('message', (raw) => {
    if (!messageLimiter.validatePayload(raw) || !messageLimiter.isAllowed(clientMeta.socketId)) {
      safeSend(ws, JSON.stringify({ type: 'ERROR', code: 'RATE_LIMIT' }));
      return;
    }

    try {
      const msg = JSON.parse(raw.toString());
      clientMeta.lastActive = Date.now();

      switch (msg.type) {
        case 'JOIN': {
          const { playerId, nickname } = msg;
          if (!playerId || typeof playerId !== 'string') return;

          clientMeta.playerId = playerId;
          const player = engine.registerPlayer(playerId, nickname);

          safeSend(ws, JSON.stringify({
            type: 'JOINED',
            player,
            state: engine.getPlayerState(playerId)
          }));

          requestBroadcast();
          break;
        }

        case 'SUBMIT_ANSWER': {
          if (!clientMeta.playerId) {
            safeSend(ws, JSON.stringify({ type: 'ERROR', code: 'UNREGISTERED' }));
            return;
          }

          const { questionId, optionIndex } = msg;
          const result = engine.submitAnswer(clientMeta.playerId, questionId, optionIndex);

          safeSend(ws, JSON.stringify({
            type: 'ANSWER_RESULT',
            result,
            playerState: engine.getPlayerState(clientMeta.playerId)
          }));

          // Immediately broadcast progress update to host and all players.
          requestBroadcast();
          break;
        }

        case 'ADMIN_ACTION': {
          if (msg.passkey !== ADMIN_PASSKEY) {
            safeSend(ws, JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED' }));
            return;
          }

          // Mark this client as admin role if it wasn't detected from URL
          const wasAdmin = clientMeta.role === 'admin';
          clientMeta.role = 'admin';
          if (!wasAdmin) {
            safeSend(ws, JSON.stringify({
              type: 'INIT',
              graph: { nodes: SPIDER_NODES, edges: SPIDER_EDGES },
              state: engine.getStageBroadcast()
            }));
          }
          handleAdminAction(msg.action, msg.payload, ws);
          break;
        }

        case 'PING': {
          safeSend(ws, JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
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
      // Reset broadcast cache on game reset
      lastPlayerJson = '';
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
  safeSend(adminWs, JSON.stringify({ type: 'ADMIN_OK', action }));
}

// Dead connection reaper (runs every 15 seconds)
setInterval(() => {
  for (const [ws, meta] of clients.entries()) {
    if (!meta.isAlive) {
      try { ws.terminate(); } catch (_) { /* already dead */ }
      clients.delete(ws);
    } else {
      meta.isAlive = false;
      try { ws.ping(); } catch (_) { clients.delete(ws); }
    }
  }
}, 15000).unref();

// Server launch with 1024 backlog queue for high-concurrency bursts
server.listen({ port: PORT, backlog: 1024 }, () => {
  console.log(`\n🕷️ ========================================`);
  console.log(`🕷️ BIT N BUILD GAME SERVER LIVE!`);
  console.log(`🕷️ HTTP & WebSocket running on port: ${PORT}`);
  console.log(`🕷️ Mobile Player:    http://localhost:${PORT}/`);
  console.log(`🕷️ Admin Host:       http://localhost:${PORT}/admin`);
  console.log(`🕷️ Health Check:     http://localhost:${PORT}/health`);
  console.log(`🕷️ ========================================\n`);
});

export { app, server, engine };
