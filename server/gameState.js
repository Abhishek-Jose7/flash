import { SPIDER_NODES, SPIDER_EDGES, UNLOCK_TIERS, TOTAL_NODES, TOTAL_EDGES } from './spiderGraphData.js';
import questionsData from './questions.json' with { type: 'json' };

export class GameStateEngine {
  constructor(customQuestions = null) {
    this.questions = customQuestions || questionsData;
    this.reset();
  }

  reset() {
    this.stage = 'LOBBY'; // 'LOBBY' | 'COUNTDOWN' | 'QUESTION_ACTIVE' | 'QUESTION_REVEAL' | 'VICTORY'
    this.currentQuestionIndex = 0;
    this.questionStartTime = 0;
    this.questionDurationSec = 15;
    this.countdownSeconds = 3;
    this.winnerTeam = null;

    // Teams Definition
    this.teams = {
      miles: {
        id: 'miles',
        name: 'Team Miles Morales',
        shortName: 'Miles',
        themeColor: '#ff003b',
        secondaryColor: '#00f0ff',
        bgDark: '#0e0408',
        score: 0,
        unlockedTiers: new Set(),
        unlockedNodes: new Set(),
        unlockedEdges: [],
        playerCount: 0
      },
      gwen: {
        id: 'gwen',
        name: 'Team Spider-Gwen',
        shortName: 'Gwen',
        themeColor: '#ff007f',
        secondaryColor: '#00f0ff',
        bgDark: '#040b12',
        score: 0,
        unlockedTiers: new Set(),
        unlockedNodes: new Set(),
        unlockedEdges: [],
        playerCount: 0
      }
    };

    // Registered Players: Map<playerId, PlayerRecord>
    this.players = new Map();

    // Idempotent Answer Submissions: Map<"playerId:questionId", SubmissionRecord>
    this.submissions = new Map();

    // Track active connection count
    this.connectedSockets = new Set();
  }

  /**
   * Register or reconnect player
   */
  registerPlayer(playerId, nickname, preferredTeam = null) {
    let player = this.players.get(playerId);
    if (!player) {
      // Auto-balance teams if not preferred or invalid
      let teamId = preferredTeam;
      if (!teamId || !this.teams[teamId]) {
        teamId = this.teams.miles.playerCount <= this.teams.gwen.playerCount ? 'miles' : 'gwen';
      }

      const spiderHandles = [
        'Web-Slinger', 'Wall-Crawler', 'Venom-Surge', 'Dimension-Hop',
        'Spider-Byte', 'Punk-Rocker', 'Ghost-Spider', 'Arachno-Kid',
        'Spidey-Sense', 'Shadow-Spider', 'Neon-Crawler', 'Bio-Electric'
      ];
      const randomSuffix = Math.floor(10 + Math.random() * 90);
      const cleanNick = (nickname && nickname.trim().slice(0, 16)) ||
        `${spiderHandles[Math.floor(Math.random() * spiderHandles.length)]}-${randomSuffix}`;

      player = {
        id: playerId,
        nickname: cleanNick,
        teamId,
        score: 0,
        correctCount: 0,
        totalAnswered: 0,
        joinedAt: Date.now()
      };

      this.players.set(playerId, player);
      this.teams[teamId].playerCount++;
    } else if (nickname && nickname.trim()) {
      player.nickname = nickname.trim().slice(0, 16);
    }

    return player;
  }

  getCurrentQuestion() {
    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * Start 3-second countdown before a question
   */
  startCountdown() {
    this.stage = 'COUNTDOWN';
    this.countdownSeconds = 3;
    return this.stage;
  }

  /**
   * Launch question
   */
  activateQuestion(index = null) {
    if (index !== null) {
      this.currentQuestionIndex = Math.max(0, Math.min(index, this.questions.length - 1));
    }
    const q = this.getCurrentQuestion();
    if (!q) return false;

    this.stage = 'QUESTION_ACTIVE';
    this.questionStartTime = Date.now();
    this.questionDurationSec = q.timeLimitSec || 15;
    return true;
  }

  /**
   * Idempotent Answer Submission with Atomic Scoring
   */
  submitAnswer(playerId, questionId, optionIndex) {
    if (this.stage !== 'QUESTION_ACTIVE') {
      return { success: false, reason: 'QUESTION_NOT_ACTIVE' };
    }

    const currentQ = this.getCurrentQuestion();
    if (!currentQ || currentQ.id !== questionId) {
      return { success: false, reason: 'QUESTION_MISMATCH' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND' };
    }

    const subKey = `${playerId}:${questionId}`;
    if (this.submissions.has(subKey)) {
      return { success: false, reason: 'ALREADY_SUBMITTED', submission: this.submissions.get(subKey) };
    }

    const now = Date.now();
    const timeElapsedMs = Math.max(0, now - this.questionStartTime);
    const isCorrect = optionIndex === currentQ.correctIndex;

    // Score calculation: Kahoot-style speed bonus
    let points = 0;
    if (isCorrect) {
      const maxPoints = 1000;
      const speedDeduction = Math.floor(timeElapsedMs * 0.05); // -50 pts per sec
      points = Math.max(150, maxPoints - speedDeduction);
    }

    const submission = {
      playerId,
      teamId: player.teamId,
      questionId,
      optionIndex,
      isCorrect,
      points,
      timeElapsedMs,
      timestamp: now
    };

    // Store submission
    this.submissions.set(subKey, submission);

    // Atomic updates to player
    player.totalAnswered++;
    if (isCorrect) {
      player.correctCount++;
      player.score += points;

      // Atomic updates to team
      const team = this.teams[player.teamId];
      team.score += points;

      // Unlock tier for team if not yet unlocked
      this.unlockTeamTier(player.teamId, currentQ.id);
    }

    return {
      success: true,
      isCorrect,
      points,
      playerScore: player.score,
      teamId: player.teamId
    };
  }

  /**
   * Unlock tier for a team based on tier index (1..8)
   */
  unlockTeamTier(teamId, tierIndex) {
    const team = this.teams[teamId];
    if (!team) return;

    const tierData = UNLOCK_TIERS.find(t => t.tier === tierIndex);
    if (!tierData || team.unlockedTiers.has(tierIndex)) return;

    team.unlockedTiers.add(tierIndex);

    // Add nodes
    tierData.nodes.forEach(nId => team.unlockedNodes.add(nId));

    // Add edges
    tierData.edges.forEach(edge => {
      // Avoid duplicate edge entries
      const exists = team.unlockedEdges.some(
        e => (e[0] === edge[0] && e[1] === edge[1]) || (e[0] === edge[1] && e[1] === edge[0])
      );
      if (!exists) {
        team.unlockedEdges.push(edge);
      }
    });

    // Check 100% completion trigger
    if (team.unlockedTiers.size === UNLOCK_TIERS.length && !this.winnerTeam) {
      this.winnerTeam = teamId;
      this.stage = 'VICTORY';
    }
  }

  /**
   * Reveal question answer & stats
   */
  revealAnswer() {
    if (this.stage === 'VICTORY') return;
    this.stage = 'QUESTION_REVEAL';
  }

  /**
   * Advance to next question or trigger VICTORY if last
   */
  nextQuestion() {
    if (this.currentQuestionIndex + 1 < this.questions.length) {
      this.currentQuestionIndex++;
      this.startCountdown();
      return true;
    } else {
      this.triggerVictory();
      return false;
    }
  }

  /**
   * Trigger Victory & determine winner deterministically
   */
  triggerVictory() {
    this.stage = 'VICTORY';

    if (!this.winnerTeam) {
      // Compare unlocked tiers count first, then total score
      const milesTiers = this.teams.miles.unlockedTiers.size;
      const gwenTiers = this.teams.gwen.unlockedTiers.size;

      if (milesTiers > gwenTiers) {
        this.winnerTeam = 'miles';
      } else if (gwenTiers > milesTiers) {
        this.winnerTeam = 'gwen';
      } else {
        // Tie breaker by team score
        this.winnerTeam = this.teams.miles.score >= this.teams.gwen.score ? 'miles' : 'gwen';
      }
    }
  }

  /**
   * Get Top-5 contributors for a team
   */
  getTopContributors(teamId, limit = 5) {
    const teamPlayers = [];
    for (const p of this.players.values()) {
      if (p.teamId === teamId) {
        teamPlayers.push({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          correctCount: p.correctCount,
          totalAnswered: p.totalAnswered
        });
      }
    }

    teamPlayers.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });

    return teamPlayers.slice(0, limit);
  }

  /**
   * Question submission stats for the current question
   */
  getCurrentQuestionStats() {
    const currentQ = this.getCurrentQuestion();
    if (!currentQ) return null;

    const stats = {
      questionId: currentQ.id,
      totalResponses: 0,
      correctResponses: 0,
      optionCounts: [0, 0, 0, 0],
      milesCorrect: 0,
      gwenCorrect: 0
    };

    for (const [key, sub] of this.submissions.entries()) {
      if (sub.questionId === currentQ.id) {
        stats.totalResponses++;
        if (sub.optionIndex >= 0 && sub.optionIndex < 4) {
          stats.optionCounts[sub.optionIndex]++;
        }
        if (sub.isCorrect) {
          stats.correctResponses++;
          if (sub.teamId === 'miles') stats.milesCorrect++;
          if (sub.teamId === 'gwen') stats.gwenCorrect++;
        }
      }
    }

    return stats;
  }

  /**
   * Compact serialization for client synchronization
   */
  getBroadcastState() {
    const currentQ = this.getCurrentQuestion();
    const remainingSec = this.stage === 'QUESTION_ACTIVE'
      ? Math.max(0, Math.ceil((this.questionDurationSec * 1000 - (Date.now() - this.questionStartTime)) / 1000))
      : 0;

    const state = {
      stage: this.stage,
      qIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      countdown: this.countdownSeconds,
      remainingSec,
      winnerTeam: this.winnerTeam,
      teams: {
        miles: {
          id: 'miles',
          name: this.teams.miles.name,
          score: this.teams.miles.score,
          unlockedTiersCount: this.teams.miles.unlockedTiers.size,
          unlockedNodeIds: Array.from(this.teams.miles.unlockedNodes),
          unlockedEdges: this.teams.miles.unlockedEdges,
          playerCount: this.teams.miles.playerCount,
          percent: Math.round((this.teams.miles.unlockedNodes.size / TOTAL_NODES) * 100)
        },
        gwen: {
          id: 'gwen',
          name: this.teams.gwen.name,
          score: this.teams.gwen.score,
          unlockedTiersCount: this.teams.gwen.unlockedTiers.size,
          unlockedNodeIds: Array.from(this.teams.gwen.unlockedNodes),
          unlockedEdges: this.teams.gwen.unlockedEdges,
          playerCount: this.teams.gwen.playerCount,
          percent: Math.round((this.teams.gwen.unlockedNodes.size / TOTAL_NODES) * 100)
        }
      },
      onlinePlayers: this.players.size
    };

    if (currentQ) {
      state.question = {
        id: currentQ.id,
        text: currentQ.question,
        options: currentQ.options,
        timeLimitSec: currentQ.timeLimitSec,
        spiderPart: currentQ.spiderPart
      };

      // Only reveal correctIndex during QUESTION_REVEAL or VICTORY
      if (this.stage === 'QUESTION_REVEAL' || this.stage === 'VICTORY') {
        state.question.correctIndex = currentQ.correctIndex;
        state.questionStats = this.getCurrentQuestionStats();
      }
    }

    if (this.stage === 'VICTORY') {
      state.topContributors = {
        miles: this.getTopContributors('miles', 5),
        gwen: this.getTopContributors('gwen', 5)
      };
    }

    return state;
  }

  /**
   * Personalized state payload for a specific player
   */
  getPlayerState(playerId) {
    const base = this.getBroadcastState();
    const player = this.players.get(playerId);

    if (player) {
      base.player = {
        id: player.id,
        nickname: player.nickname,
        teamId: player.teamId,
        score: player.score,
        correctCount: player.correctCount
      };

      const currentQ = this.getCurrentQuestion();
      if (currentQ) {
        const sub = this.submissions.get(`${playerId}:${currentQ.id}`);
        if (sub) {
          base.playerAnswer = {
            optionIndex: sub.optionIndex,
            isCorrect: sub.isCorrect,
            points: sub.points
          };
        }
      }
    }

    return base;
  }
}
