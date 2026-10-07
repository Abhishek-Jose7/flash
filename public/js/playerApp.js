import { SpiderCanvasRenderer } from './spiderCanvas.js';

class PlayerApp {
  constructor() {
    this.ws = null;
    this.playerId = this.getOrCreatePlayerId();
    this.nickname = localStorage.getItem('spider_nick') || '';
    this.player = null;
    this.state = null;
    this.hasAnswered = false;
    this.selectedOption = null;

    // Canvas visualizer instance
    this.spiderRenderer = null;

    // Screens
    this.screens = {
      join: document.getElementById('screen-join'),
      lobby: document.getElementById('screen-lobby'),
      game: document.getElementById('screen-game'),
      victory: document.getElementById('screen-victory')
    };

    // Sub-views inside screen-game
    this.gameViews = {
      countdown: document.getElementById('view-countdown'),
      question: document.getElementById('view-question'),
      reveal: document.getElementById('view-reveal')
    };

    this.bindEvents();
    this.initCanvas();
    this.connectWebSocket();
  }

  getOrCreatePlayerId() {
    let id = localStorage.getItem('spider_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('spider_player_id', id);
    }
    return id;
  }

  initCanvas() {
    const canvas = document.getElementById('mobile-spider-canvas');
    if (canvas) {
      this.spiderRenderer = new SpiderCanvasRenderer(canvas);
      this.spiderRenderer.start();
    }
  }

  bindEvents() {
    // Join form
    const btnJoin = document.getElementById('btn-join');
    const inputNick = document.getElementById('input-nick');
    const joinError = document.getElementById('join-error-msg');

    if (btnJoin && inputNick) {
      if (this.nickname) inputNick.value = this.nickname;

      const submitJoin = () => {
        const val = inputNick.value.trim();
        if (!val) {
          if (joinError) joinError.style.display = 'block';
          inputNick.focus();
          return;
        }

        if (joinError) joinError.style.display = 'none';
        this.nickname = val;
        localStorage.setItem('spider_nick', this.nickname);
        this.sendJoin();
      };

      btnJoin.addEventListener('click', submitJoin);
      inputNick.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitJoin();
      });
      inputNick.addEventListener('input', () => {
        if (joinError) joinError.style.display = 'none';
      });
    }

    // MCQ Answer Buttons
    const mcqBtns = document.querySelectorAll('.mcq-btn');
    mcqBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const opt = parseInt(btn.dataset.opt, 10);
        this.submitAnswer(opt);
      });
    });

  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      const connStatus = document.getElementById('conn-status');
      if (connStatus) {
        connStatus.textContent = '⚡ CONNECTED TO LIVE GAME';
        connStatus.style.color = 'var(--orchid)';
      }

      if (this.nickname) {
        this.sendJoin();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      const connStatus = document.getElementById('conn-status');
      if (connStatus) {
        connStatus.textContent = '⚠️ RECONNECTING TO LIVE GAME...';
        connStatus.style.color = 'var(--blush)';
      }
      setTimeout(() => this.connectWebSocket(), 1500);
    };

    this.ws.onerror = (err) => {
      console.warn('WS error:', err);
    };
  }

  sendJoin() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.nickname) {
      this.ws.send(JSON.stringify({
        type: 'JOIN',
        playerId: this.playerId,
        nickname: this.nickname
      }));
    }
  }

  submitAnswer(opt) {
    if (this.hasAnswered || !this.state || this.state.stage !== 'QUESTION_ACTIVE') return;

    if (navigator.vibrate) navigator.vibrate(50);

    this.hasAnswered = true;
    this.selectedOption = opt;

    // Apply immediate accepted & locked states to buttons
    const btns = document.querySelectorAll('.mcq-btn');
    btns.forEach(b => {
      if (parseInt(b.dataset.opt, 10) === opt) {
        b.classList.add('selected-accepted');
      } else {
        b.classList.add('dimmed');
      }
    });

    // Spawn comic action sticker popup
    this.spawnActionSticker();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBMIT_ANSWER',
        questionId: this.state.question.id,
        optionIndex: opt
      }));
    }
  }

  spawnActionSticker() {
    const container = document.getElementById('sticker-container');
    if (!container) return;

    const img = document.createElement('img');
    img.src = Math.random() > 0.4 ? '/img/sticker-thwip.svg' : '/img/sticker-boom.svg';
    img.className = 'action-sticker';

    const x = Math.floor(25 + Math.random() * 45);
    const y = Math.floor(15 + Math.random() * 40);
    img.style.left = `${x}%`;
    img.style.top = `${y}%`;

    container.appendChild(img);
    setTimeout(() => img.remove(), 600);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT': {
        this.updateState(msg.state);
        break;
      }

      case 'JOINED': {
        this.player = msg.player;
        this.updatePlayerUI();
        this.updateState(msg.state);
        break;
      }

      case 'STATE_UPDATE': {
        this.updateState(msg.state);
        break;
      }

      case 'ANSWER_RESULT': {
        this.handleAnswerResult(msg.result);
        if (msg.playerState) this.updateState(msg.playerState);
        break;
      }

      default:
        break;
    }
  }

  handleAnswerResult(result) {
    if (!result) return;
    if (result.isCorrect) {
      if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
    } else {
      if (navigator.vibrate) navigator.vibrate([150]);
    }
  }

  updatePlayerUI() {
    if (!this.player) return;

    const isBit = this.player.teamId === 'bit';

    // Update body theme classes
    document.body.className = isBit ? 'team-bit' : 'team-build';

    // Header bar
    const teamNameEl = document.getElementById('user-team-name');
    const teamDotEl = document.getElementById('user-team-dot');
    const userScoreEl = document.getElementById('user-score-val');
    const userNickEl = document.getElementById('user-nick-display');

    if (teamNameEl) {
      teamNameEl.textContent = isBit ? 'TEAM BIT (MILES)' : 'TEAM BUILD (GWEN)';
      teamNameEl.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (teamDotEl) {
      teamDotEl.style.background = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (userScoreEl) userScoreEl.textContent = (this.player.score || 0).toLocaleString();
    if (userNickEl) userNickEl.textContent = this.player.nickname;

    // Lobby Screen
    const lobbyTitle = document.getElementById('lobby-team-title');
    const lobbyHero = document.getElementById('lobby-team-hero');
    const lobbyMascot = document.getElementById('lobby-mascot-img');
    const lobbyCard = document.getElementById('lobby-panel-card');

    if (lobbyTitle) {
      lobbyTitle.textContent = isBit ? 'YOU ARE ON TEAM BIT' : 'YOU ARE ON TEAM BUILD';
      lobbyTitle.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (lobbyHero) {
      lobbyHero.textContent = isBit ? 'Fighting alongside Miles Morales' : 'Fighting alongside Spider-Gwen';
    }
    if (lobbyMascot) {
      lobbyMascot.src = isBit ? '/img/miles.png' : '/img/gwen.png';
      lobbyMascot.style.filter = `drop-shadow(0 4px 16px ${isBit ? 'var(--bit-red-glow)' : 'var(--build-pink-glow)'})`;
    }
    if (lobbyCard) {
      lobbyCard.className = `lobby-card ${isBit ? 'highlight-bit' : 'highlight-build'}`;
    }

    // Set Spider Canvas Theme
    if (this.spiderRenderer) {
      if (isBit) {
        this.spiderRenderer.setTheme('#E3212A', '#F4F6F8', 'rgba(227, 33, 42, 0.78)');
      } else {
        this.spiderRenderer.setTheme('#2474CC', '#F4F6F8', 'rgba(36, 116, 204, 0.78)');
      }
    }
  }

  updateState(state) {
    if (!state) return;
    this.state = state;

    if (state.player) {
      this.player = state.player;
      this.updatePlayerUI();
    }

    // Update Spider Canvas for current player's team
    if (this.spiderRenderer && this.player && state.teams) {
      const myTeam = state.teams[this.player.teamId];
      if (myTeam) {
        this.spiderRenderer.setProgress(myTeam.percent || 0);
      }
    }

    // Update Live Battle Bar & Percentages
    if (state.teams) {
      const bitFill = document.getElementById('bit-bar-fill');
      const bitVal = document.getElementById('bit-pct-val');
      const buildFill = document.getElementById('build-bar-fill');
      const buildVal = document.getElementById('build-pct-val');
      const lobbyCount = document.getElementById('lobby-online-count');

      const bitPct = state.teams.bit ? state.teams.bit.percent : 0;
      const buildPct = state.teams.build ? state.teams.build.percent : 0;

      if (bitFill) bitFill.style.width = `${bitPct}%`;
      if (bitVal) bitVal.textContent = `BIT: ${bitPct}%`;

      if (buildFill) buildFill.style.width = `${buildPct}%`;
      if (buildVal) buildVal.textContent = `BUILD: ${buildPct}%`;

      if (lobbyCount) {
        lobbyCount.textContent = (state.onlinePlayers || 0);
      }
    }

    // Stage Routing
    this.renderStage(state);
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      if (el) {
        if (key === name) el.classList.add('active');
        else el.classList.remove('active');
      }
    }
  }

  showGameView(viewName) {
    for (const [key, el] of Object.entries(this.gameViews)) {
      if (el) {
        el.style.display = (key === viewName) ? (key === 'question' ? 'flex' : 'flex') : 'none';
      }
    }
  }

  renderStage(state) {
    if (!this.player) {
      this.showScreen('join');
      return;
    }

    switch (state.stage) {
      case 'LOBBY': {
        this.showScreen('lobby');
        break;
      }

      case 'COUNTDOWN': {
        this.showScreen('game');
        this.showGameView('countdown');

        const countEl = document.getElementById('countdown-num');
        if (countEl) {
          countEl.textContent = state.countdown;
        }
        this.hasAnswered = false;
        this.selectedOption = null;
        break;
      }

      case 'QUESTION_ACTIVE': {
        this.showScreen('game');
        this.showGameView('question');

        const q = state.question;
        if (q) {
          document.getElementById('q-meta-round').textContent = `ROUND ${state.qIndex + 1} / ${state.totalQuestions}`;
          document.getElementById('q-category-badge').textContent = q.category || 'TECH';
          document.getElementById('q-difficulty-badge').textContent = q.difficulty || 'MEDIUM';
          document.getElementById('q-part-tag').textContent = `TARGET: ${q.spiderPart || 'SPIDER NODE'}`;
          document.getElementById('q-text').textContent = q.text;

          // Render Options
          const btns = document.querySelectorAll('.mcq-btn');
          btns.forEach((btn, idx) => {
            const label = btn.querySelector('.mcq-label');
            if (label && q.options && q.options[idx]) {
              label.textContent = q.options[idx];
            }
            btn.classList.remove('selected-accepted', 'dimmed', 'reveal-correct', 'reveal-wrong');
          });

          // Re-highlight if reconnecting
          if (state.playerAnswer) {
            this.hasAnswered = true;
            const chosen = state.playerAnswer.optionIndex;
            btns.forEach(b => {
              if (parseInt(b.dataset.opt, 10) === chosen) b.classList.add('selected-accepted');
              else b.classList.add('dimmed');
            });
          }

          // Timer Bar
          const timerFill = document.getElementById('timer-bar-fill');
          if (timerFill) {
            const pct = Math.max(0, (state.remainingSec / (q.timeLimitSec || 15)) * 100);
            timerFill.style.width = `${pct}%`;
          }
        }
        break;
      }

      case 'QUESTION_REVEAL': {
        this.showScreen('game');
        this.showGameView('reveal');

        const q = state.question;
        const resTitle = document.getElementById('reveal-title');
        const resSub = document.getElementById('reveal-sub');
        const resBox = document.getElementById('reveal-box');

        // Reveal accepted/correct/wrong button styles
        const btns = document.querySelectorAll('.mcq-btn');
        if (q && q.correctIndex !== undefined) {
          btns.forEach((btn, idx) => {
            btn.classList.remove('selected-accepted');
            if (idx === q.correctIndex) {
              btn.classList.add('reveal-correct');
            } else if (this.selectedOption === idx) {
              btn.classList.add('reveal-wrong');
            } else {
              btn.classList.add('dimmed');
            }
          });
        }

        if (state.playerAnswer) {
          if (state.playerAnswer.isCorrect) {
            if (resBox) resBox.className = 'reveal-card correct';
            if (resTitle) {
              resTitle.textContent = '⚡ THWIP! CORRECT!';
              resTitle.style.color = 'var(--orchid)';
            }
            if (resSub) {
              resSub.textContent = `+${state.playerAnswer.points} Points added to ${this.player.teamId === 'bit' ? 'Team Bit' : 'Team Build'}!`;
            }
          } else {
            if (resBox) resBox.className = 'reveal-card wrong';
            if (resTitle) {
              resTitle.textContent = '🕸️ MISSED!';
              resTitle.style.color = 'var(--red)';
            }
            if (resSub) {
              resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
            }
          }
        } else {
          if (resBox) resBox.className = 'reveal-card';
          if (resTitle) {
            resTitle.textContent = '⏳ TIME UP!';
            resTitle.style.color = 'var(--orchid)';
          }
          if (resSub) {
            resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
          }
        }
        break;
      }

      case 'VICTORY': {
        this.showScreen('victory');

        const winBanner = document.getElementById('victory-team-banner');
        const winSub = document.getElementById('victory-sub-banner');
        const isWinner = state.winnerTeam === this.player.teamId;

        if (winBanner) {
          const winName = state.winnerTeam === 'bit' ? 'TEAM BIT WINS!' : 'TEAM BUILD WINS!';
          winBanner.textContent = winName;
          winBanner.style.color = state.winnerTeam === 'bit' ? 'var(--bit-red)' : 'var(--build-pink)';
        }

        if (winSub) {
          winSub.textContent = isWinner
            ? '🏆 YOUR TEAM FULLY ASSEMBLED THE SPIDER-MAN EMBLEM!'
            : '🕸️ YOUR CREW CAME THROUGH! THE CITY IS SAFE!';
        }

        // Populate Top 5 MVPs Leaderboard Table with Accuracy (Correct Count) & Score
        const top5List = document.getElementById('top5-list-mvp');
        if (top5List && state.topContributors && state.winnerTeam) {
          const mvps = state.topContributors[state.winnerTeam] || [];
          top5List.innerHTML = mvps.map((mvp, idx) => {
            const isMe = mvp.id === this.player.id;
            const rankIcon = idx === 0 ? '👑' : `#${idx + 1}`;
            const correctCount = mvp.correctCount || 0;
            const totalQ = state.totalQuestions || 8;

            return `
              <li class="leaderboard-row ${idx === 0 ? 'rank-1' : ''} ${isMe ? 'is-me' : ''}">
                <span class="rank-col">${rankIcon}</span>
                <span class="name-col">${mvp.nickname} ${isMe ? '⭐ (YOU)' : ''}</span>
                <span class="accuracy-col">🎯 ${correctCount}/${totalQ} Correct</span>
                <span class="score-col">${(mvp.score || 0).toLocaleString()} PTS</span>
              </li>
            `;
          }).join('');
        }
        break;
      }

      default:
        break;
    }
  }
}

// Start player app
window.addEventListener('DOMContentLoaded', () => {
  new PlayerApp();
});
