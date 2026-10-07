import { sound } from './audioEngine.js';
import { SpiderCanvasRenderer } from './spiderCanvas.js';

class PlayerApp {
  constructor() {
    this.ws = null;
    this.playerId = this.getOrCreatePlayerId();
    this.nickname = localStorage.getItem('spider_nick') || '';
    this.player = null;
    this.state = null;
    this.graphData = null;
    this.selectedOption = null;
    this.hasAnswered = false;

    // Spider Canvas Renderer instance
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

  generateRandomNickname() {
    const handles = [
      'Cyber-Slinger', 'Bit-Crawler', 'Glitch-Spider', 'Web-Architect',
      'Kernel-Spidey', 'Async-Slinger', 'Neon-Byte', 'Null-Pointer',
      'Ghost-Spider', 'Syntax-Crawler', 'Bug-Buster', 'Quantum-Spidey'
    ];
    const randHandle = handles[Math.floor(Math.random() * handles.length)];
    const randNum = Math.floor(10 + Math.random() * 90);
    return `${randHandle}-${randNum}`;
  }

  initCanvas() {
    const canvas = document.getElementById('mobile-spider-canvas');
    if (canvas) {
      this.spiderRenderer = new SpiderCanvasRenderer(canvas);
      this.spiderRenderer.start();
    }
  }

  bindEvents() {
    // Nickname generator dice
    const btnDice = document.getElementById('btn-dice-nick');
    const inputNick = document.getElementById('input-nick');
    if (btnDice && inputNick) {
      btnDice.addEventListener('click', () => {
        sound.init();
        sound.playTap();
        inputNick.value = this.generateRandomNickname();
      });
    }

    // Join button
    const btnJoin = document.getElementById('btn-join');
    if (btnJoin && inputNick) {
      if (this.nickname) inputNick.value = this.nickname;
      else inputNick.value = this.generateRandomNickname();

      const submitJoin = () => {
        sound.init();
        sound.playThwip();
        this.nickname = inputNick.value.trim() || this.generateRandomNickname();
        localStorage.setItem('spider_nick', this.nickname);
        this.sendJoin();
      };

      btnJoin.addEventListener('click', submitJoin);
      inputNick.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitJoin();
      });
    }

    // MCQ Answer Buttons
    const mcqBtns = document.querySelectorAll('.mcq-btn');
    mcqBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const opt = parseInt(btn.dataset.opt, 10);
        this.submitAnswer(opt, e);
      });
    });

    // Mute toggle
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
      });
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      const connStatus = document.getElementById('conn-status');
      if (connStatus) {
        connStatus.textContent = '⚡ CONNECTED TO MULTIVERSE';
        connStatus.style.color = '#00ff66';
      }

      // Automatically re-join if player identity already exists in localStorage
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
        connStatus.textContent = '⚠️ RECONNECTING TO MULTIVERSE...';
        connStatus.style.color = '#ffcc00';
      }
      setTimeout(() => this.connectWebSocket(), 1500);
    };

    this.ws.onerror = (err) => {
      console.warn('WS error:', err);
    };
  }

  sendJoin() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'JOIN',
        playerId: this.playerId,
        nickname: this.nickname
      }));
    }
  }

  submitAnswer(opt, event = null) {
    if (this.hasAnswered || !this.state || this.state.stage !== 'QUESTION_ACTIVE') return;

    sound.playTap();
    if (navigator.vibrate) navigator.vibrate(40);

    this.hasAnswered = true;
    this.selectedOption = opt;

    // Visual button feedback
    const btns = document.querySelectorAll('.mcq-btn');
    btns.forEach(b => {
      if (parseInt(b.dataset.opt, 10) === opt) {
        b.classList.add('selected');
      } else {
        b.classList.add('dimmed');
      }
    });

    // Spawn comic sticker pop effect near click
    this.spawnComicSticker(event);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBMIT_ANSWER',
        questionId: this.state.question.id,
        optionIndex: opt
      }));
    }
  }

  spawnComicSticker(event) {
    const container = document.getElementById('sticker-container');
    if (!container) return;

    const img = document.createElement('img');
    img.src = Math.random() > 0.4 ? '/img/sticker-thwip.svg' : '/img/sticker-boom.svg';
    img.className = 'comic-sticker';

    // Position sticker randomly across the lower panel
    const x = Math.floor(20 + Math.random() * 55);
    const y = Math.floor(15 + Math.random() * 45);
    img.style.left = `${x}%`;
    img.style.top = `${y}%`;

    container.appendChild(img);
    setTimeout(() => img.remove(), 700);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT': {
        this.graphData = msg.graph;
        if (this.spiderRenderer && this.graphData) {
          this.spiderRenderer.setGraphData(this.graphData.nodes, this.graphData.edges);
        }
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
      sound.playCorrect();
      sound.playThwip();
      if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
    } else {
      sound.playWrong();
      if (navigator.vibrate) navigator.vibrate([150]);
    }
  }

  updatePlayerUI() {
    if (!this.player) return;

    const isBit = this.player.teamId === 'bit';

    // Update body theme classes
    document.body.className = isBit ? 'team-bit' : 'team-build';

    // Header status bar
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

    // Lobby screen info
    const lobbyTitle = document.getElementById('lobby-team-title');
    const lobbyHero = document.getElementById('lobby-team-hero');
    const lobbyMascot = document.getElementById('lobby-mascot-img');

    if (lobbyTitle) {
      lobbyTitle.textContent = isBit ? 'YOU ARE ON TEAM BIT' : 'YOU ARE ON TEAM BUILD';
      lobbyTitle.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (lobbyHero) {
      lobbyHero.textContent = isBit ? 'Fighting alongside Miles Morales' : 'Fighting alongside Spider-Gwen';
    }
    if (lobbyMascot) {
      lobbyMascot.src = isBit ? '/img/chibi-miles.svg' : '/img/chibi-gwen.svg';
    }

    // Set Spider Canvas Theme
    if (this.spiderRenderer) {
      if (isBit) {
        this.spiderRenderer.setTheme('#ff003b', '#00f0ff', 'rgba(255, 0, 59, 0.8)');
      } else {
        this.spiderRenderer.setTheme('#ff007f', '#00e5ff', 'rgba(255, 0, 127, 0.8)');
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
        this.spiderRenderer.updateUnlocked(myTeam.unlockedNodeIds, myTeam.unlockedEdges);
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
          sound.playTick(state.countdown === 1);
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
            btn.classList.remove('selected', 'dimmed', 'correct-highlight');
          });

          // Re-highlight if reconnecting
          if (state.playerAnswer) {
            this.hasAnswered = true;
            const chosen = state.playerAnswer.optionIndex;
            btns.forEach(b => {
              if (parseInt(b.dataset.opt, 10) === chosen) b.classList.add('selected');
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

        if (state.playerAnswer) {
          if (state.playerAnswer.isCorrect) {
            if (resBox) resBox.className = 'reveal-box correct';
            if (resTitle) {
              resTitle.textContent = '⚡ THWIP! CORRECT!';
              resTitle.style.color = '#00ff66';
            }
            if (resSub) {
              resSub.textContent = `+${state.playerAnswer.points} Points added to ${this.player.teamId === 'bit' ? 'Team Bit' : 'Team Build'}!`;
            }
          } else {
            if (resBox) resBox.className = 'reveal-box wrong';
            if (resTitle) {
              resTitle.textContent = '🕸️ MISSED!';
              resTitle.style.color = '#ff003b';
            }
            if (resSub) {
              resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
            }
          }
        } else {
          if (resBox) resBox.className = 'reveal-box';
          if (resTitle) {
            resTitle.textContent = '⏳ TIME UP!';
            resTitle.style.color = '#ffcc00';
          }
          if (resSub) {
            resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
          }
        }
        break;
      }

      case 'VICTORY': {
        this.showScreen('victory');
        sound.playVictory();

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
            ? '🏆 YOUR TEAM FULLY ASSEMBLED THE AMAZING SPIDER-MAN!'
            : '🕸️ VALIANT EFFORT! The Spider-Verse is saved!';
        }

        // Populate Top 5 MVPs from the winning team
        const top5List = document.getElementById('top5-list-mvp');
        if (top5List && state.topContributors && state.winnerTeam) {
          const mvps = state.topContributors[state.winnerTeam] || [];
          top5List.innerHTML = mvps.map((mvp, idx) => `
            <li class="top5-item ${idx === 0 ? 'rank-1' : ''}">
              <span class="top5-rank">#${idx + 1}</span>
              <span class="top5-name">${mvp.nickname} ${mvp.id === this.player.id ? '⭐ (YOU)' : ''}</span>
              <span class="top5-score">${(mvp.score || 0).toLocaleString()} PTS</span>
            </li>
          `).join('');
        }
        break;
      }

      default:
        break;
    }
  }
}

// Start player app on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new PlayerApp();
});
