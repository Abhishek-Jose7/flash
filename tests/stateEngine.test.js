import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStateEngine } from '../server/gameState.js';
import { UNLOCK_TIERS, TOTAL_NODES, TOTAL_EDGES } from '../server/spiderGraphData.js';

test('Spider-Man Graph Predefined Geometry is intact', () => {
  assert.equal(TOTAL_NODES, 48, 'Should have exactly 48 nodes');
  assert.equal(TOTAL_EDGES, 64, 'Should have 64 edges');
  assert.equal(UNLOCK_TIERS.length, 8, 'Should have 8 progressive unlock tiers');
});

test('Team balancing on player join', () => {
  const engine = new GameStateEngine();

  // Register 10 players
  for (let i = 1; i <= 10; i++) {
    engine.registerPlayer(`player_${i}`, `Slinger_${i}`);
  }

  assert.equal(engine.teams.miles.playerCount, 5, 'Miles should have 5 players');
  assert.equal(engine.teams.gwen.playerCount, 5, 'Gwen should have 5 players');
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
  const pMiles = engine.registerPlayer('p_m', 'MilesKid', 'miles');
  const pGwen = engine.registerPlayer('p_g', 'GwenGirl', 'gwen');

  engine.activateQuestion(0); // Q1
  const q = engine.getCurrentQuestion();

  // Only Miles answers correctly
  engine.submitAnswer(pMiles.id, q.id, q.correctIndex);
  engine.submitAnswer(pGwen.id, q.id, (q.correctIndex + 1) % 4); // wrong answer

  assert.ok(engine.teams.miles.unlockedTiers.has(1), 'Team Miles should unlock Tier 1');
  assert.ok(engine.teams.miles.unlockedNodes.size > 0, 'Team Miles has unlocked nodes');
  assert.equal(engine.teams.gwen.unlockedTiers.has(1), false, 'Team Gwen should NOT unlock Tier 1');
  assert.equal(engine.teams.gwen.unlockedNodes.size, 0, 'Team Gwen has 0 unlocked nodes');
});

test('Top-5 Contributor rank calculation', () => {
  const engine = new GameStateEngine();

  // Register 10 players for Team Miles
  const players = [];
  for (let i = 1; i <= 10; i++) {
    players.push(engine.registerPlayer(`pm_${i}`, `MVP_Candidate_${i}`, 'miles'));
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

  const top5 = engine.getTopContributors('miles', 5);
  assert.equal(top5.length, 5, 'Should return exactly 5 MVPs');
  assert.ok(top5[0].score >= top5[1].score, 'Top 1 score >= Top 2 score');
  assert.ok(top5[1].score >= top5[2].score, 'Top 2 score >= Top 3 score');
});

test('Deterministic Victory Trigger after all 8 questions or tier 8 unlock', () => {
  const engine = new GameStateEngine();
  const pMiles = engine.registerPlayer('p_miles_champ', 'Champ', 'miles');

  // Unlock all 8 tiers for Miles
  for (let tier = 1; tier <= 8; tier++) {
    engine.unlockTeamTier('miles', tier);
  }

  assert.equal(engine.teams.miles.unlockedTiers.size, 8, 'Miles has all 8 tiers unlocked');
  assert.equal(engine.stage, 'VICTORY', 'Stage should be VICTORY');
  assert.equal(engine.winnerTeam, 'miles', 'Miles should be declared winner');
});
