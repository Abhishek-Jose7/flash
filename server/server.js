import http from 'node:http';
import path from 'node:path';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import { GameStateEngine } from './gameState.js';
import { RateLimiter } from './rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSKEY = process.env.ADMIN_KEY || (process.env.NODE_ENV === 'production' ? '' : 'spiderverse');
if (!ADMIN_PASSKEY) {
  throw new Error('ADMIN_KEY must be set in production.');
}
const MAX_CONNECTIONS = Number.parseInt(process.env.MAX_CONNECTIONS || '1000', 10);
const MAX_PLAYERS = Number.parseInt(process.env.MAX_PLAYERS || '1000', 10);
const MAX_BUFFERED_BYTES = 256 * 1024;
const PUBLIC_URL = process.env.PUBLIC_URL; // optional canonical URL for the QR code (else derived from Host)

// Constant-time compare so the admin key can't be recovered by timing.
const isAdminKey = (v) => {
  if (typeof v !== 'string') return false;
  const a = Buffer.from(v);
  const b = Buffer.from(ADMIN_PASSKEY);
  return a.length === b.length && timingSafeEqual(a, b);
};

// Login swaps the admin key for a random 12h session token, so the key itself never
// sits in browser storage or on the WebSocket. ponytail: in-memory, a restart forces re-login.
const adminSessions = new Map(); // token -> expiry ms
const isAdminSession = (t) => typeof t === 'string' && (adminSessions.get(t) ?? 0) > Date.now();

// Last X-Forwarded-For hop is the one appended by our own proxy (Caddy / Cloud Run);
// earlier hops are client-controlled and spoofable.
const clientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',').at(-1).trim() || req.socket.remoteAddress || 'unknown';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 2048, perMessageDeflate: false });

const engine = new GameStateEngine();
// High burst tokens (600) to support 200-500 phones scanning QR simultaneously from the same venue Wi-Fi / NAT
const connectionLimiter = new RateLimiter({ maxTokens: 800, refillRate: 200, maxPayloadBytes: 2048 });
const messageLimiter = new RateLimiter({ maxTokens: 25, refillRate: 10, maxPayloadBytes: 2048 });
const adminLoginLimiter = new RateLimiter({ maxTokens: 10, refillRate: 10 / 60, maxPayloadBytes: 8192 });

// Connection tracking: ws -> { playerId, ip, isAlive, lastActive }
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
app.disable('x-powered-by');
app.use(compression()); // Cloud Run / bare Node don't compress; Caddy does it in compose
app.use(express.json({ limit: '8kb' }));

// --- HTTP Middleware & Static File Streaming ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Cache control for static assets (instant mobile loads)
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // unhashed names: let deploys land fast
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


// Dynamic QR code generator pointing to current host / LAN IP
app.get('/api/qr', async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const targetUrl = PUBLIC_URL || `${protocol}://${host}/`;
    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      color: {
        dark: '#10141B',
        light: '#00000000'
      },
      margin: 1
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'private, max-age=60'); // Host-derived: never share via CDN
    res.send(svg);
  } catch (err) {
    res.status(500).send('Error generating QR');
  }
});

// Admin Authentication API
app.post('/api/admin/login', (req, res) => {
  if (!adminLoginLimiter.isAllowed(clientIp(req))) {
    return res.status(429).json({ success: false, message: 'Too many login attempts. Try again shortly.' });
  }
  const { username, password } = req.body || {};
  if (username === 'admin' && isAdminKey(password)) {
    const token = randomBytes(24).toString('hex');
    adminSessions.set(token, Date.now() + 12 * 3600 * 1000);
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

// --- State Broadcast Engine (Throttled, Batched & Delta-Aware) ---
let broadcastPending = false;
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 200; // Max ~5 updates/sec (was 60ms / 16/sec)

// Pre-serialized broadcast cache — avoids re-serializing identical payloads
let lastPlayerJson = '';

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

  for (const ws of clients.keys()) safeSend(ws, playerJson);
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
  const ip = clientIp(req);

  if (clients.size >= MAX_CONNECTIONS || !connectionLimiter.isAllowed(ip)) {
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

  safeSend(ws, JSON.stringify({ type: 'INIT', state: engine.getPlayerBroadcast() }));

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
          // Bounded id, one identity per socket, capped roster: stops memory-stuffing via fake joins.
          if (typeof playerId !== 'string' || !playerId || playerId.length > 64) return;
          if (clientMeta.playerId && clientMeta.playerId !== playerId) return;
          if (!engine.players.has(playerId) && engine.players.size >= MAX_PLAYERS) {
            safeSend(ws, JSON.stringify({ type: 'ERROR', code: 'GAME_FULL' }));
            return;
          }

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
          if (!isAdminSession(msg.passkey)) {
            safeSend(ws, JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED' }));
            return;
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

// Drop expired admin sessions
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of adminSessions) if (exp <= now) adminSessions.delete(t);
}, 600000).unref();

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
// Outlive Cloud Run / ELB idle timeouts (60s) so keep-alive sockets aren't reset mid-request.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen({ port: PORT, backlog: 1024 }, () => {
  console.log(`\n🕷️ ========================================`);
  console.log(`🕷️ BIT N BUILD GAME SERVER LIVE!`);
  console.log(`🕷️ HTTP & WebSocket running on port: ${PORT}`);
  console.log(`🕷️ Mobile Player:    http://localhost:${PORT}/`);
  console.log(`🕷️ Admin Host:       http://localhost:${PORT}/admin`);
  console.log(`🕷️ Health Check:     http://localhost:${PORT}/health`);
  console.log(`🕷️ ========================================\n`);
});

// Cloud Run / Docker send SIGTERM on deploy: tell clients to reconnect (1001) and exit cleanly.
process.on('SIGTERM', () => {
  for (const ws of clients.keys()) ws.close(1001, 'SERVER_RESTART');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));

export { app, server, engine };
