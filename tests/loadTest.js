import { WebSocket } from 'ws';

const TOTAL_CLIENTS = Number.parseInt(process.env.CLIENTS || '300', 10);
const PORT = Number.parseInt(process.env.PORT || '3100', 10);
process.env.PORT = String(PORT);
const WS_URL = `ws://127.0.0.1:${PORT}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { server, engine } = await import('../server/server.js');

async function runLoadTest() {
  const clients = [];
  let connectedCount = 0;
  let joinedCount = 0;
  let answersAccepted = 0;
  let duplicateRejections = 0;
  let errorsCount = 0;
  let answerResults = 0;

  try {
    await new Promise((resolve, reject) => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      server.once('error', reject);
    });

    console.log(`Starting ${TOTAL_CLIENTS} WebSocket clients against ${WS_URL}`);
    const connectPromises = [];

    for (let i = 0; i < TOTAL_CLIENTS; i++) {
      const playerId = `stress_player_${i}_${Date.now()}`;
      const ws = new WebSocket(WS_URL);
      const client = { ws, playerId, id: i };
      clients.push(client);

      connectPromises.push(new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(value);
        };
        const timeout = setTimeout(() => finish(null), 10000);

        ws.on('open', () => {
          connectedCount++;
          ws.send(JSON.stringify({ type: 'JOIN', playerId, nickname: `Player-${i}` }));
        });

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'JOINED') {
              joinedCount++;
              finish(client);
            } else if (msg.type === 'ANSWER_RESULT') {
              answerResults++;
              if (msg.result?.success) answersAccepted++;
              if (msg.result?.reason === 'ALREADY_SUBMITTED') duplicateRejections++;
            } else if (msg.type === 'ERROR') {
              errorsCount++;
            }
          } catch {
            errorsCount++;
          }
        });

        ws.on('error', () => {
          errorsCount++;
          finish(null);
        });
        ws.on('close', () => finish(null));
      }));

      // Pace the connection ramp slightly while still producing a concentrated burst.
      if (i % 10 === 9) await delay(10);
    }

    const joinedClients = (await Promise.all(connectPromises)).filter(Boolean);
    console.log(`Connected ${connectedCount}/${TOTAL_CLIENTS}; joined ${joinedCount}/${TOTAL_CLIENTS}`);

    engine.activateQuestion(0);
    const question = engine.getCurrentQuestion();
    if (!question) throw new Error('No first question is configured');

    const answerPromises = joinedClients.map(({ ws, id }) => new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1500);
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const optionIndex = (id % 4);
          ws.send(JSON.stringify({ type: 'SUBMIT_ANSWER', questionId: question.id, optionIndex }));
          if (id % 5 === 0) {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'SUBMIT_ANSWER', questionId: question.id, optionIndex }));
              }
            }, 30);
          }
        }
        resolve();
      }, 50 + Math.random() * 750);
    }));
    await Promise.all(answerPromises);
    await delay(1800);

    const expectedSubmissions = joinedClients.length;
    const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`Answer results ${answerResults}; accepted ${answersAccepted}; duplicate retries rejected ${duplicateRejections}`);
    console.log(`Submissions ${engine.submissions.size}/${expectedSubmissions}; teams ${engine.teams.bit.playerCount}/${engine.teams.build.playerCount}`);
    console.log(`Unlocked tiers ${engine.teams.bit.unlockedTiers.size}/${engine.teams.build.unlockedTiers.size}; RSS ${memMb} MB; errors ${errorsCount}`);

    const passed = connectedCount === TOTAL_CLIENTS && joinedCount === TOTAL_CLIENTS &&
      answersAccepted === TOTAL_CLIENTS && engine.submissions.size === TOTAL_CLIENTS && errorsCount === 0;
    if (!passed) throw new Error('Load test invariants failed');
    console.log(`PASS: ${TOTAL_CLIENTS} concurrent players joined and submitted without errors.`);
  } finally {
    for (const { ws } of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    }
    await delay(100);
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}

runLoadTest().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
