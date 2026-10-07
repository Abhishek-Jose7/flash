import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStateEngine } from '../server/gameState.js';


test('Team balancing on player join', () => {
  const engine = new GameStateEngine();

  // Register 10 players
  for (let i = 1; i <= 10; i++) {
    engine.registerPlayer(`player_${i}`, `Slinger_${i}`);
  }

  assert.equal(engine.teams.bit.playerCount, 5, 'Bit should have 5 players');
  assert.equal(engine.teams.build.playerCount, 5, 'Build should have 5 players');
  assert.equal(engine.players.size, 10, 'Total 10 registered players');
});

test('Idempotency and double-tap prevention', () => {
  const engine = new GameStateEngine();
  const player = engine.registerPlayer('p_double', 'FastFinger');

  // Activate Q1
  engine.activateQuestion(0);
  const q = engine.getCurrentQuestion();
  assert.ok(q, 'Current question exists');

  // 1st submission (Correct answer)
  const res1 = engine.submitAnswer(player.id, q.id, q.correctIndex);
  assert.equal(res1.success, true, 'First submission should succeed');
  assert.equal(res1.isCorrect, true, 'Should be marked correct');
  assert.ok(Number.isFinite(res1.timeElapsedMs), 'Response time is returned for the reveal screen');
  assert.equal(engine.getPlayerState(player.id).playerAnswer.timeElapsedMs, res1.timeElapsedMs);
  const pointsAwarded = res1.points;
  assert.ok(pointsAwarded > 0, 'Points should be > 0');
  assert.equal(player.score, pointsAwarded, 'Player score updated');

  // 2nd submission (Double tap / duplicate submission)
  const res2 = engine.submitAnswer(player.id, q.id, q.correctIndex);
  assert.equal(res2.success, false, 'Duplicate submission must be rejected');
  assert.equal(res2.reason, 'ALREADY_SUBMITTED', 'Reason should be ALREADY_SUBMITTED');
  assert.equal(player.score, pointsAwarded, 'Player score must NOT increase on duplicate submission');
});

test('Node unlock progression per team', () => {
  const engine = new GameStateEngine();
  const pBit = engine.registerPlayer('p_m', 'BitKid', 'bit');
  const pBuild = engine.registerPlayer('p_g', 'BuildGirl', 'build');

  engine.activateQuestion(0); // Q1
  const q = engine.getCurrentQuestion();

  // Only Bit answers correctly
  engine.submitAnswer(pBit.id, q.id, q.correctIndex);
  engine.submitAnswer(pBuild.id, q.id, (q.correctIndex + 1) % 4); // wrong answer

  assert.ok(engine.teams.bit.unlockedTiers.has(1), 'Team Bit should unlock Tier 1');
  assert.equal(engine.getPlayerBroadcast().teams.bit.percent, 10, 'Team Bit progress advances one tenth');
  assert.equal(engine.teams.build.unlockedTiers.has(1), false, 'Team Build should NOT unlock Tier 1');
  assert.equal(engine.getPlayerBroadcast().teams.build.percent, 0, 'Team Build progress stays at zero');
});

test('Top-5 Contributor rank calculation', () => {
  const engine = new GameStateEngine();

  // Register 10 players for Team Bit
  const players = [];
  for (let i = 1; i <= 10; i++) {
    players.push(engine.registerPlayer(`pm_${i}`, `MVP_Candidate_${i}`, 'bit'));
  }

  // Activate Q1
  engine.activateQuestion(0);
  const q = engine.getCurrentQuestion();

  // Simulate players answering at staggered timestamps
  players.forEach((p, idx) => {
    // Top players answer correctly
    if (idx < 7) {
      engine.submitAnswer(p.id, q.id, q.correctIndex);
    }
  });

  const top5 = engine.getTopContributors('bit', 5);
  assert.equal(top5.length, 5, 'Should return exactly 5 MVPs');
  assert.ok(top5[0].score >= top5[1].score, 'Top 1 score >= Top 2 score');
  assert.ok(top5[1].score >= top5[2].score, 'Top 2 score >= Top 3 score');
});

test('Victory triggers after every configured question tier is unlocked', () => {
  const engine = new GameStateEngine();

  for (let tier = 1; tier <= engine.questions.length; tier++) {
    engine.unlockTeamTier('bit', tier);
  }

  assert.equal(engine.teams.bit.unlockedTiers.size, engine.questions.length, 'Bit has every configured tier');
  assert.equal(engine.stage, 'VICTORY', 'Stage should be VICTORY');
  assert.equal(engine.winnerTeam, 'bit', 'Bit should be declared winner');
});
