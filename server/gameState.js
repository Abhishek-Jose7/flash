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
    this.revealDurationSec = 2;
    this.countdownSeconds = 10;
    this.winnerTeam = null;
    this.demoSeq = 0;
    this.demoCount = 0; // server-side demo players (no sockets): inflate counts/scores for showcases

    // Two Teams: Team Bit red and Team Build blue.
    this.teams = {
      bit: {
        id: 'bit',
        name: 'TEAM BIT',
        hero: 'Miles Morales',
        themeColor: '#E3212A',
        secondaryColor: '#F4F6F8',
        bgDark: '#10141B',
        score: 0,
        correctCount: 0,
        unlockedTiers: new Set(),
        playerCount: 0
      },
      build: {
        id: 'build',
        name: 'TEAM BUILD',
        hero: 'Spider-Gwen',
        themeColor: '#2474CC',
        secondaryColor: '#F4F6F8',
        bgDark: '#10141B',
        score: 0,
        correctCount: 0,
        unlockedTiers: new Set(),
        playerCount: 0
      }
    };

    // Registered Players: Map<playerId, PlayerRecord>
    this.players = new Map();

    // Idempotent Answer Submissions: Map<"playerId:questionId", SubmissionRecord>
    this.submissions = new Map();

    // Change tracking for delta-aware broadcasts
    this._stateVersion = 0;
    this._lastBroadcastHash = '';

    // Cached question stats (invalidated on new submission)
    this._cachedQuestionStats = null;
    this._cachedQuestionStatsId = null;
  }

  _bumpVersion() {
    this._stateVersion++;
    this._cachedQuestionStats = null; // invalidate stats cache
  }

  /**
   * Register or reconnect player
   */
  registerPlayer(playerId, nickname, preferredTeam = null) {
    let player = this.players.get(playerId);
    if (!player) {
      // Balance arrivals; randomize which team gets the first player in each tie.
      let teamId = preferredTeam;
      if (!teamId || !this.teams[teamId]) {
        const bitCount = this.teams.bit.playerCount;
        const buildCount = this.teams.build.playerCount;
        if (bitCount < buildCount) teamId = 'bit';
        else if (buildCount < bitCount) teamId = 'build';
        else teamId = Math.random() < 0.5 ? 'bit' : 'build';
      }

      const spiderHandles = [
        'Cyber-Slinger', 'Bit-Crawler', 'Bug-Hunter', 'Syntax-Spidey',
        'Stack-Overload', 'Glitch-Spider', 'Web-Architect', 'Ghost-Dev',
        'Kernel-Panic', 'Async-Spidey', 'Neon-Byte', 'Null-Pointer'
      ];
      const randomSuffix = Math.floor(10 + Math.random() * 90);
      const cleanNick = (typeof nickname === 'string' && nickname.trim().slice(0, 16)) ||
        `${spiderHandles[Math.floor(Math.random() * spiderHandles.length)]}-${randomSuffix}`;

      player = {
        id: playerId,
        nickname: cleanNick,
        teamId,
        score: 0,
        correctCount: 0,
        totalAnswered: 0,
        totalResponseTimeMs: 0,
        joinedAt: Date.now()
      };

      this.players.set(playerId, player);
      this.teams[teamId].playerCount++;
      this._bumpVersion();
    } else if (typeof nickname === 'string' && nickname.trim()) {
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
    this.countdownSeconds = 10;
    this._bumpVersion();
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
    this._bumpVersion();
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

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= currentQ.options.length) {
      return { success: false, reason: 'INVALID_OPTION' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND' };
    }

    const subKey = `${playerId}:${questionId}`;
    if (this.submissions.has(subKey)) {
      return { success: false, reason: 'ALREADY_SUBMITTED', submission: this.submissions.get(subKey) };
    }

    const timeElapsedMs = Math.max(0, Date.now() - this.questionStartTime);
    const { isCorrect, points } = this._recordAnswer(player, currentQ, optionIndex, timeElapsedMs);
    if (isCorrect) this.unlockTeamTier(player.teamId, currentQ.id);
    this._bumpVersion();

    return {
      success: true,
      isCorrect,
      points,
      timeElapsedMs,
      playerScore: player.score,
      teamId: player.teamId
    };
  }

  // Shared by real and demo answers: score (Kahoot-style speed bonus), store, update player + team.
  _recordAnswer(player, q, optionIndex, timeElapsedMs) {
    const isCorrect = optionIndex === q.correctIndex;
    const points = isCorrect ? Math.max(200, 1000 - Math.floor(timeElapsedMs * 0.05)) : 0;
    const submission = {
      playerId: player.id,
      teamId: player.teamId,
      questionId: q.id,
      optionIndex,
      isCorrect,
      points,
      timeElapsedMs,
      timestamp: Date.now()
    };
    this.submissions.set(`${player.id}:${q.id}`, submission);

    player.totalAnswered++;
    player.totalResponseTimeMs += timeElapsedMs;
    if (isCorrect) {
      player.correctCount++;
      player.score += points;
      const team = this.teams[player.teamId];
      team.correctCount++;
      if (!player.demo) team.score += points; // team.score breaks victory ties: demo players must not sway it
    }
    return submission;
  }

  addDemoPlayers(n) {
    for (let i = 0; i < n; i++) {
      this.registerPlayer(`demo_${this.demoSeq++}`).demo = true;
      this.demoCount++;
    }
  }

  // Demo players "answer" when the question closes: ~55% accurate, 2-12s in, so real players can beat them.
  // They never unlock tiers, so they can't decide which team wins.
  _simulateDemoAnswers() {
    const q = this.getCurrentQuestion();
    if (!q || !this.demoCount) return;
    for (const p of this.players.values()) {
      if (!p.demo || this.submissions.has(`${p.id}:${q.id}`)) continue;
      const right = Math.random() < 0.55;
      const opt = right ? q.correctIndex : (q.correctIndex + 1 + Math.floor(Math.random() * (q.options.length - 1))) % q.options.length;
      this._recordAnswer(p, q, opt, 2000 + Math.random() * 10000);
    }
  }

  unlockTeamTier(teamId, tierIndex) {
    const team = this.teams[teamId];
    if (!team || !Number.isInteger(tierIndex) || tierIndex < 1 || tierIndex > this.questions.length) return;

    if (team.unlockedTiers.has(tierIndex)) return;
    team.unlockedTiers.add(tierIndex);

    if (team.unlockedTiers.size >= this.questions.length && !this.winnerTeam) {
      this.winnerTeam = teamId;
      this.stage = 'VICTORY';
    }

    this._bumpVersion();
  }

  revealAnswer() {
    if (this.stage === 'VICTORY') return;
    if (this.stage === 'QUESTION_ACTIVE') this._simulateDemoAnswers();
    this.stage = 'QUESTION_REVEAL';
    this.revealStartTime = Date.now();
    this._bumpVersion();
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

    this._bumpVersion();
  }

  getTopContributors(teamId, limit = 5) {
    const teamPlayers = [];
    for (const p of this.players.values()) {
      if (p.teamId === teamId && !p.demo) {
        teamPlayers.push({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          correctCount: p.correctCount,
          totalAnswered: p.totalAnswered,
          totalResponseTimeMs: p.totalResponseTimeMs
        });
      }
    }

    teamPlayers.sort((a, b) => {
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalResponseTimeMs - b.totalResponseTimeMs;
    });

    return teamPlayers.slice(0, limit);
  }

  getCurrentQuestionStats() {
    const currentQ = this.getCurrentQuestion();
    if (!currentQ) return null;

    // Return cached stats if still valid for this question
    if (this._cachedQuestionStats && this._cachedQuestionStatsId === currentQ.id) {
      return this._cachedQuestionStats;
    }

    const stats = {
      questionId: currentQ.id,
      totalResponses: 0,
      correctResponses: 0,
      optionCounts: [0, 0, 0, 0],
      bitCorrect: 0,
      buildCorrect: 0
    };

    for (const sub of this.submissions.values()) {
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

    this._cachedQuestionStats = stats;
    this._cachedQuestionStatsId = currentQ.id;
    return stats;
  }

  /**
   * Slim team summary for player broadcasts (~50 bytes per team instead of ~500+)
   * Players only need: score, percent, playerCount
   */
  _getSlimTeams() {
    return {
      bit: {
        id: 'bit',
        name: this.teams.bit.name,
        hero: this.teams.bit.hero,
        score: this.teams.bit.correctCount,
        playerCount: this.teams.bit.playerCount,
        percent: Math.min(100, Math.round((this.teams.bit.unlockedTiers.size / this.questions.length) * 100))
      },
      build: {
        id: 'build',
        name: this.teams.build.name,
        hero: this.teams.build.hero,
        score: this.teams.build.correctCount,
        playerCount: this.teams.build.playerCount,
        percent: Math.min(100, Math.round((this.teams.build.unlockedTiers.size / this.questions.length) * 100))
      }
    };
  }

  /**
   * Common state fields shared across all client types
   */
  _getBaseState() {
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
      onlinePlayers: this.players.size
    };

    if (currentQ) {
      state.question = {
        id: currentQ.id,
        difficulty: currentQ.difficulty,
        category: currentQ.category,
        text: currentQ.question,
        options: currentQ.options,
        timeLimitSec: currentQ.timeLimitSec
      };

      if (this.stage === 'QUESTION_REVEAL' || this.stage === 'VICTORY') {
        state.question.correctIndex = currentQ.correctIndex;
        state.questionStats = this.getCurrentQuestionStats();
      }
    }

    if (this.stage === 'VICTORY') {
      state.topContributors = {
        bit: this.getTopContributors('bit', 10),
        build: this.getTopContributors('build', 10)
      };
    }

    return state;
  }

  /**
   * Slim broadcast for phone players (~200-350 bytes)
   * Excludes: unlockedNodeIds, unlockedEdges, unlockedTiersCount
   */
  getPlayerBroadcast() {
    const state = this._getBaseState();
    state.teams = this._getSlimTeams();
    return state;
  }

  /**
   * Player-specific state for JOIN and ANSWER_RESULT responses
   * Builds on top of the slim player broadcast to avoid duplication
   */
  getPlayerState(playerId) {
    const base = this.getPlayerBroadcast();
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
            points: sub.points,
            timeElapsedMs: sub.timeElapsedMs
          };
        }
      }
    }

    return base;
  }
}

