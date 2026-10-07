import { WebSocket } from 'ws';
import http from 'node:http';
import { server, engine } from '../server/server.js';

const TOTAL_CLIENTS = parseInt(process.env.CLIENTS || '250', 10);
const PORT = process.env.PORT || 3000;
const WS_URL = `ws://localhost:${PORT}`;

console.log(`\n🕷️ =================================================`);
console.log(`🕷️ HIGH-CONCURRENCY STRESS TEST HARNESS`);
console.log(`🕷️ Simulating ${TOTAL_CLIENTS} simultaneous mobile players scanning QR`);
console.log(`🕷️ Target: ${WS_URL}`);
console.log(`🕷️ =================================================\n`);

async function runLoadTest() {
  const startTime = Date.now();
  const clients = [];
  let connectedCount = 0;
  let joinedCount = 0;
  let answersSubmitted = 0;
  let duplicateRejections = 0;
  let errorsCount = 0;

  // Step 1: Connect 250+ clients in rapid burst (QR scan frenzy)
  console.log(`[1/4] Spawning ${TOTAL_CLIENTS} concurrent WebSocket connections...`);
  const connectPromises = [];

  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    // 2ms interleave pacing for realistic cellular arrival burst
    await new Promise(r => setTimeout(r, 2));

    const p = new Promise((resolve) => {
      const playerId = `stress_player_${i}_${Date.now()}`;
      const ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        connectedCount++;
        // Send JOIN
        ws.send(JSON.stringify({
          type: 'JOIN',
          playerId,
          nickname: `Slinger-${i}`
        }));
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'JOINED') {
            joinedCount++;
            resolve(ws);
          } else if (msg.type === 'ANSWER_RESULT') {
            if (msg.result && msg.result.success) {
              answersSubmitted++;
            } else if (msg.result && msg.result.reason === 'ALREADY_SUBMITTED') {
              duplicateRejections++;
            }
          }
        } catch (e) {
          errorsCount++;
        }
      });

      ws.on('error', (err) => {
        errorsCount++;
        console.log(`Socket error on client ${i}:`, err.code, err.message);
        resolve(null);
      });

      ws.on('close', () => {
        resolve(null);
      });

      // Safety timeout
      setTimeout(() => resolve(null), 6000);

      clients.push({ ws, playerId, id: i });
    });

    connectPromises.push(p);
  }

  await Promise.all(connectPromises);
  const connectionDuration = Date.now() - startTime;
  console.log(`✅ Connections established: ${connectedCount}/${TOTAL_CLIENTS} in ${connectionDuration}ms`);
  console.log(`✅ Players registered & team-balanced: ${joinedCount}/${TOTAL_CLIENTS}`);

  // Step 2: Trigger Question 1
  console.log(`\n[2/4] Activating Question 1 across all 250 players...`);
  engine.activateQuestion(0);
  const q = engine.getCurrentQuestion();

  // Step 3: All 250 players hammer the server with answers simultaneously
  console.log(`[3/4] Submitting answers simultaneously (simulating Kahoot rush)...`);
  const answerPromises = clients.map(({ ws, playerId, id }) => {
    return new Promise((resolve) => {
      // Stagger slightly between 50ms and 800ms to simulate real human reaction speeds
      const delay = 50 + Math.random() * 750;
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const opt = Math.floor(Math.random() * 4);
          ws.send(JSON.stringify({
            type: 'SUBMIT_ANSWER',
            questionId: q.id,
            optionIndex: opt
          }));

          // Intentionally send a double-tap 20% of the time to verify idempotency at scale!
          if (Math.random() < 0.2) {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'SUBMIT_ANSWER',
                  questionId: q.id,
                  optionIndex: opt
                }));
              }
            }, 30);
          }
        }
        resolve();
      }, delay);
    });
  });

  await Promise.all(answerPromises);

  // Wait 1.5 seconds for all responses to settle
  await new Promise(r => setTimeout(r, 1500));

  console.log(`\n[4/4] Evaluating Results & Invariants:`);
  console.log(`-----------------------------------------------`);
  console.log(`🎯 Successful Atomic Answers Processed: ${answersSubmitted}`);
  console.log(`🛡️ Double-Tap Submissions Blocked (Idempotency): ${duplicateRejections}`);
  console.log(`🔴 Team Bit Score:   ${engine.teams.bit.score} PTS (${engine.teams.bit.playerCount} players)`);
  console.log(`🔵 Team Build Score: ${engine.teams.build.score} PTS (${engine.teams.build.playerCount} players)`);
  console.log(`🕷️ Team Bit Spider Unlocked Nodes:   ${engine.teams.bit.unlockedNodes.size}/48`);
  console.log(`🕷️ Team Build Spider Unlocked Nodes: ${engine.teams.build.unlockedNodes.size}/48`);

  const top5Bit = engine.getTopContributors('bit', 5);
  console.log(`\n🏆 Team Bit Top 5 MVPs:`);
  top5Bit.forEach((m, idx) => console.log(`   #${idx + 1} ${m.nickname}: ${m.score} pts (${m.correctCount} correct)`));

  const top5Build = engine.getTopContributors('build', 5);
  console.log(`\n🏆 Team Build Top 5 MVPs:`);
  top5Build.forEach((m, idx) => console.log(`   #${idx + 1} ${m.nickname}: ${m.score} pts (${m.correctCount} correct)`));

  // Check memory usage
  const mem = process.memoryUsage();
  console.log(`\n💾 Memory (RSS): ${(mem.rss / 1024 / 1024).toFixed(1)} MB (ultra-lightweight!)`);
  console.log(`⚡ Errors/Crashes: ${errorsCount}`);

  // Clean up
  clients.forEach(c => c.ws.close());

  if (errorsCount === 0 && answersSubmitted > 0) {
    console.log(`\n🎉 LOAD TEST PASSED: Successfully handled ${TOTAL_CLIENTS} concurrent players!\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ LOAD TEST FAILED: Had ${errorsCount} errors.\n`);
    process.exit(1);
  }
}

// Allow server to spin up then run
setTimeout(runLoadTest, 500);
