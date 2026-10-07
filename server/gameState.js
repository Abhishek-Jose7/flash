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
    this.revealStartTime = 0;
    this.revealDurationSec = 4;
    this.countdownSeconds = 3;
    this.winnerTeam = null;

    // Two Teams: Team Bit (Miles Morales Red) vs Team Build (Spider-Gwen Pink/Teal)
    this.teams = {
      bit: {
        id: 'bit',
        name: 'TEAM BIT',
        hero: 'Miles Morales',
        themeColor: '#ff003b',
        secondaryColor: '#00f0ff',
        bgDark: '#0a0307',
        score: 0,
        unlockedTiers: new Set(),
        unlockedNodes: new Set(),
        unlockedEdges: [],
        playerCount: 0
      },
      build: {
        id: 'build',
        name: 'TEAM BUILD',
        hero: 'Spider-Gwen',
        themeColor: '#ff007f',
        secondaryColor: '#00f0ff',
        bgDark: '#03080f',
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
  }

  /**
   * Register or reconnect player
   */
  registerPlayer(playerId, nickname, preferredTeam = null) {
    let player = this.players.get(playerId);
    if (!player) {
      // Auto-balance teams
      let teamId = preferredTeam;
      if (!teamId || !this.teams[teamId]) {
        teamId = this.teams.bit.playerCount <= this.teams.build.playerCount ? 'bit' : 'build';
      }

      const spiderHandles = [
        'Cyber-Slinger', 'Bit-Crawler', 'Bug-Hunter', 'Syntax-Spidey',
        'Stack-Overload', 'Glitch-Spider', 'Web-Architect', 'Ghost-Dev',
        'Kernel-Panic', 'Async-Spidey', 'Neon-Byte', 'Null-Pointer'
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

  startCountdown() {
    this.stage = 'COUNTDOWN';
    this.countdownSeconds = 3;
    return this.stage;
  }

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
      const speedDeduction = Math.floor(timeElapsedMs * 0.05);
      points = Math.max(200, maxPoints - speedDeduction);
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

    this.submissions.set(subKey, submission);

    // Atomic updates to player
    player.totalAnswered++;
    if (isCorrect) {
      player.correctCount++;
      player.score += points;

      // Atomic updates to team
      const team = this.teams[player.teamId];
      team.score += points;

      // Unlock tier for team
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

  unlockTeamTier(teamId, tierIndex) {
    const team = this.teams[teamId];
    if (!team) return;

    const tierData = UNLOCK_TIERS.find(t => t.tier === tierIndex);
    if (!tierData || team.unlockedTiers.has(tierIndex)) return;

    team.unlockedTiers.add(tierIndex);

    tierData.nodes.forEach(nId => team.unlockedNodes.add(nId));

    tierData.edges.forEach(edge => {
      const exists = team.unlockedEdges.some(
        e => (e[0] === edge[0] && e[1] === edge[1]) || (e[0] === edge[1] && e[1] === edge[0])
      );
      if (!exists) {
        team.unlockedEdges.push(edge);
      }
    });

    if (team.unlockedTiers.size === UNLOCK_TIERS.length && !this.winnerTeam) {
      this.winnerTeam = teamId;
      this.stage = 'VICTORY';
    }
  }

  revealAnswer() {
    if (this.stage === 'VICTORY') return;
    this.stage = 'QUESTION_REVEAL';
    this.revealStartTime = Date.now();
  }

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

  triggerVictory() {
    this.stage = 'VICTORY';

    if (!this.winnerTeam) {
      const bitTiers = this.teams.bit.unlockedTiers.size;
      const buildTiers = this.teams.build.unlockedTiers.size;

      if (bitTiers > buildTiers) {
        this.winnerTeam = 'bit';
      } else if (buildTiers > bitTiers) {
        this.winnerTeam = 'build';
      } else {
        this.winnerTeam = this.teams.bit.score >= this.teams.build.score ? 'bit' : 'build';
      }
    }
  }

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

  getCurrentQuestionStats() {
    const currentQ = this.getCurrentQuestion();
    if (!currentQ) return null;

    const stats = {
      questionId: currentQ.id,
      totalResponses: 0,
      correctResponses: 0,
      optionCounts: [0, 0, 0, 0],
      bitCorrect: 0,
      buildCorrect: 0
    };

    for (const [key, sub] of this.submissions.entries()) {
      if (sub.questionId === currentQ.id) {
        stats.totalResponses++;
        if (sub.optionIndex >= 0 && sub.optionIndex < 4) {
          stats.optionCounts[sub.optionIndex]++;
        }
        if (sub.isCorrect) {
          stats.correctResponses++;
          if (sub.teamId === 'bit') stats.bitCorrect++;
          if (sub.teamId === 'build') stats.buildCorrect++;
        }
      }
    }

    return stats;
  }

  getBroadcastState() {
    const currentQ = this.getCurrentQuestion();
    const remainingSec = this.stage === 'QUESTION_ACTIVE'
      ? Math.max(0, Math.ceil((this.questionDurationSec * 1000 - (Date.now() - this.questionStartTime)) / 1000))
      : 0;

    const revealRemainingSec = this.stage === 'QUESTION_REVEAL'
      ? Math.max(0, Math.ceil((this.revealDurationSec * 1000 - (Date.now() - this.revealStartTime)) / 1000))
      : 0;

    const state = {
      stage: this.stage,
      qIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      countdown: this.countdownSeconds,
      remainingSec,
      revealRemainingSec,
      winnerTeam: this.winnerTeam,
      teams: {
        bit: {
          id: 'bit',
          name: this.teams.bit.name,
          hero: this.teams.bit.hero,
          score: this.teams.bit.score,
          unlockedTiersCount: this.teams.bit.unlockedTiers.size,
          unlockedNodeIds: Array.from(this.teams.bit.unlockedNodes),
          unlockedEdges: this.teams.bit.unlockedEdges,
          playerCount: this.teams.bit.playerCount,
          percent: Math.round((this.teams.bit.unlockedNodes.size / TOTAL_NODES) * 100)
        },
        build: {
          id: 'build',
          name: this.teams.build.name,
          hero: this.teams.build.hero,
          score: this.teams.build.score,
          unlockedTiersCount: this.teams.build.unlockedTiers.size,
          unlockedNodeIds: Array.from(this.teams.build.unlockedNodes),
          unlockedEdges: this.teams.build.unlockedEdges,
          playerCount: this.teams.build.playerCount,
          percent: Math.round((this.teams.build.unlockedNodes.size / TOTAL_NODES) * 100)
        }
      },
      onlinePlayers: this.players.size
    };

    if (currentQ) {
      state.question = {
        id: currentQ.id,
        difficulty: currentQ.difficulty,
        category: currentQ.category,
        text: currentQ.question,
        options: currentQ.options,
        timeLimitSec: currentQ.timeLimitSec,
        spiderPart: currentQ.spiderPart
      };

      if (this.stage === 'QUESTION_REVEAL' || this.stage === 'VICTORY') {
        state.question.correctIndex = currentQ.correctIndex;
        state.questionStats = this.getCurrentQuestionStats();
      }
    }

    if (this.stage === 'VICTORY') {
      state.topContributors = {
        bit: this.getTopContributors('bit', 5),
        build: this.getTopContributors('build', 5)
      };
    }

    return state;
  }

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
