import { SpiderCanvasRenderer } from './spiderCanvas.js?v=tracker11';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

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
        if (!val || !/^\d+$/.test(val)) {
          if (joinError) {
            joinError.textContent = 'Enter a valid roll number.';
            joinError.style.display = 'block';
          }
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
        const val = inputNick.value;
        if (/[^\d]/.test(val)) {
          inputNick.value = val.replace(/[^\d]/g, '');
          if (joinError) {
            joinError.textContent = 'Enter only numbers.';
            joinError.style.display = 'block';
          }
        } else {
          if (joinError) joinError.style.display = 'none';
        }
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
      const topConn = document.getElementById('top-conn-status');
      if (topConn) { topConn.textContent = '[ONLINE]'; topConn.style.color = '#40c057'; }
      // Rejoin the same persistent player record after a network drop or refresh.
      if (this.nickname) this.sendJoin();
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
      const topConn = document.getElementById('top-conn-status');
      if (topConn) { topConn.textContent = '[OFFLINE]'; topConn.style.color = '#fa5252'; }
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

    this.hasAnswered = true;
    this.selectedOption = opt;

    // Apply immediate accepted & locked states to buttons
    const btns = document.querySelectorAll('.mcq-btn');
    btns.forEach(b => {
      if (parseInt(b.dataset.opt, 10) === opt) {
        b.classList.add('selected-pending');
      } else {
        b.classList.add('dimmed');
      }
      b.style.pointerEvents = 'none';
    });

    const answerStatus = document.getElementById('answer-status');
    if (answerStatus) answerStatus.textContent = '...';

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

      case 'ERROR': {
        this.hasAnswered = false;
        this.selectedOption = null;
        document.querySelectorAll('.mcq-btn').forEach(btn => btn.classList.remove('selected-pending', 'selected-accepted', 'dimmed'));
        const answerStatus = document.getElementById('answer-status');
        if (answerStatus) answerStatus.textContent = 'ANSWER NOT RECEIVED · TRY AGAIN';
        break;
      }

      default:
        break;
    }
  }

  handleAnswerResult(result) {
    if (!result) return;
    if (!result.success) {
      this.hasAnswered = false;
      this.selectedOption = null;
      document.querySelectorAll('.mcq-btn').forEach(btn => btn.classList.remove('selected-pending', 'selected-accepted', 'reveal-correct', 'reveal-wrong', 'dimmed'));
      const answerStatus = document.getElementById('answer-status');
      if (answerStatus) answerStatus.textContent = 'ANSWER NOT RECEIVED · TRY AGAIN';
      return;
    }

    document.querySelectorAll('.mcq-btn').forEach(btn => {
      btn.classList.remove('selected-pending', 'selected-accepted');
      if (parseInt(btn.dataset.opt, 10) === this.selectedOption) {
        btn.classList.add(result.isCorrect ? 'reveal-correct' : 'reveal-wrong');
      } else {
        btn.classList.add('dimmed');
      }
    });
    const answerStatus = document.getElementById('answer-status');
    if (answerStatus) answerStatus.textContent = result.isCorrect ? 'CORRECT!' : 'INCORRECT!';
  }

  updatePlayerUI() {
    if (!this.player) return;

    const isBit = this.player.teamId === 'bit';

    // Update body theme classes
    document.body.className = `player-page ${isBit ? 'team-bit' : 'team-build'}`;

    // Header bar
    const teamNameEl = document.getElementById('user-team-name');
    const teamDotEl = document.getElementById('user-team-dot');
    const userScoreEl = document.getElementById('user-score-val');
    const userNickEl = document.getElementById('user-nick-display');

    if (teamNameEl) {
      teamNameEl.textContent = isBit ? 'TEAM BIT (MILES)' : 'TEAM BUILD (GWEN)';
      teamNameEl.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    const topTeam = document.getElementById('top-team-name');
    if (topTeam) {
       topTeam.textContent = isBit ? 'BIT' : 'BUILD';
       topTeam.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (teamDotEl) {
      teamDotEl.style.background = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (userScoreEl) userScoreEl.textContent = (this.player.score || 0).toLocaleString();
    if (userNickEl) userNickEl.textContent = this.player.nickname;

    // Lobby Screen
    const lobbyTitle = document.getElementById('lobby-team-title');
    const lobbyHero = document.getElementById('lobby-team-hero');
    const lobbyArtLabel = document.getElementById('lobby-art-label');
    const lobbyMascot = document.getElementById('lobby-mascot-img');
    const lobbyCard = document.getElementById('lobby-panel-card');

    if (lobbyTitle) {
      lobbyTitle.textContent = isBit ? 'YOU ARE ON TEAM BIT' : 'YOU ARE ON TEAM BUILD';
      lobbyTitle.style.color = isBit ? 'var(--bit-red)' : 'var(--build-pink)';
    }
    if (lobbyHero) {
      lobbyHero.textContent = isBit ? 'MILES MORALES' : 'SPIDER-GWEN';
    }
    if (lobbyArtLabel) lobbyArtLabel.textContent = isBit ? 'TEAM BIT' : 'TEAM BUILD';
    if (lobbyMascot) {
      lobbyMascot.src = isBit ? '/img/miles.webp' : '/img/gwen.webp';
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
      const lobbyBitCount = document.getElementById('lobby-bit-count');
      const lobbyBuildCount = document.getElementById('lobby-build-count');
      const gameBitScore = document.getElementById('game-bit-score');
      const gameBuildScore = document.getElementById('game-build-score');
      const gameBitPlayers = document.getElementById('game-bit-players');
      const gameBuildPlayers = document.getElementById('game-build-players');

      const bitPct = state.teams.bit ? state.teams.bit.percent : 0;
      const buildPct = state.teams.build ? state.teams.build.percent : 0;

      if (bitFill) bitFill.style.width = `${bitPct}%`;
      if (bitVal) bitVal.textContent = `BIT: ${bitPct}%`;

      if (buildFill) buildFill.style.width = `${buildPct}%`;
      if (buildVal) buildVal.textContent = `BUILD: ${buildPct}%`;

      if (lobbyCount) {
        lobbyCount.textContent = (state.onlinePlayers || 0);
      }
      if (lobbyBitCount) lobbyBitCount.textContent = state.teams.bit ? state.teams.bit.playerCount : 0;
      if (lobbyBuildCount) lobbyBuildCount.textContent = state.teams.build ? state.teams.build.playerCount : 0;
      if (gameBitScore) gameBitScore.textContent = (state.teams.bit ? state.teams.bit.score : 0).toLocaleString();
      if (gameBuildScore) gameBuildScore.textContent = (state.teams.build ? state.teams.build.score : 0).toLocaleString();
      if (gameBitPlayers) gameBitPlayers.textContent = state.teams.bit ? state.teams.bit.playerCount : 0;
      if (gameBuildPlayers) gameBuildPlayers.textContent = state.teams.build ? state.teams.build.playerCount : 0;
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
    const bgWatermark = document.querySelector('.bg-watermark');
    if (bgWatermark) {
       if (name === 'game') {
           if (!bgWatermark.dataset.shrunk) {
               bgWatermark.style.display = 'block';
               bgWatermark.classList.remove('fade-out');
               bgWatermark.style.top = '50%';
               bgWatermark.style.left = '50%';
               bgWatermark.style.width = '110%';
               
               void bgWatermark.offsetWidth; // force reflow
               bgWatermark.dataset.shrunk = 'true';

               const canvasEl = document.getElementById('mobile-spider-canvas');
               if (canvasEl) {
                   const watermarkParent = bgWatermark.offsetParent || document.body;
                   const parentRect = watermarkParent.getBoundingClientRect();
                   const rect = canvasEl.getBoundingClientRect();
                   bgWatermark.style.top = (rect.top - parentRect.top + rect.height/2) + 'px';
                   bgWatermark.style.left = (rect.left - parentRect.left + rect.width/2) + 'px';
                   bgWatermark.style.width = rect.width + 'px';
               } else {
                   bgWatermark.style.top = '85%';
                   bgWatermark.style.width = '140px';
               }

               setTimeout(() => {
                   if (bgWatermark.dataset.shrunk) {
                       bgWatermark.classList.add('fade-out');
                   }
               }, 1500);
               setTimeout(() => {
                   if (bgWatermark.dataset.shrunk) {
                       bgWatermark.style.display = 'none';
                   }
               }, 2300);
           }
       } else {
           bgWatermark.style.display = 'block';
           bgWatermark.classList.remove('fade-out');
           delete bgWatermark.dataset.shrunk;
           bgWatermark.style.top = '50%';
           bgWatermark.style.left = '50%';
           bgWatermark.style.width = '110%';
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

    const spideyWrap = document.getElementById('hanging-spidey-wrap');
    if (spideyWrap) {
      if (state.stage === 'LOBBY' || state.stage === 'JOIN') {
        spideyWrap.classList.remove('pulled-up');
        spideyWrap.style.animation = ''; // restore swing
        spideyWrap.style.transform = '';
        spideyWrap.style.transition = '';
      } else {
        if (!spideyWrap.classList.contains('pulled-up')) {
          spideyWrap.classList.add('pulled-up');
          const currentTransform = window.getComputedStyle(spideyWrap).transform;
          spideyWrap.style.animation = 'none';
          spideyWrap.style.transform = currentTransform;
          
          // force reflow to ensure it doesn't snap
          void spideyWrap.offsetWidth;

          requestAnimationFrame(() => {
            spideyWrap.style.transition = 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            spideyWrap.style.transform = 'translateY(-150%)';
          });
        }
      }
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
        const countdownRound = document.getElementById('countdown-round');
        if (countEl) {
          countEl.textContent = state.countdown;
        }
        if (countdownRound) countdownRound.textContent = `ROUND ${state.qIndex + 1} / ${state.totalQuestions}`;
        this.hasAnswered = false;
        this.selectedOption = null;
        break;
      }

      case 'QUESTION_ACTIVE': {
        this.showScreen('game');
        this.showGameView('question');

        const q = state.question;
        if (q) {
          const roundText = `ROUND ${state.qIndex + 1} / ${state.totalQuestions}`;
          document.getElementById('q-meta-round').textContent = roundText;
          document.getElementById('game-round-count').textContent = roundText;
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
            btn.classList.remove('selected-pending', 'selected-accepted', 'dimmed', 'reveal-correct', 'reveal-wrong');
            btn.style.pointerEvents = 'auto';
          });

          const answerStatus = document.getElementById('answer-status');
          if (answerStatus) {
            if (state.playerAnswer) {
              answerStatus.textContent = state.playerAnswer.isCorrect ? 'CORRECT!' : 'INCORRECT!';
            } else {
              answerStatus.textContent = this.hasAnswered ? '...' : 'CHOOSE AN ANSWER';
            }
          }

          // Re-highlight if reconnecting
          if (state.playerAnswer) {
            this.hasAnswered = true;
            const chosen = state.playerAnswer.optionIndex;
            this.selectedOption = chosen;
            btns.forEach(b => {
              if (parseInt(b.dataset.opt, 10) === chosen) {
                b.classList.add(state.playerAnswer.isCorrect ? 'reveal-correct' : 'reveal-wrong');
              } else {
                b.classList.add('dimmed');
              }
              b.style.pointerEvents = 'none';
            });
          } else if (this.hasAnswered) {
            btns.forEach(b => {
              if (parseInt(b.dataset.opt, 10) === this.selectedOption) b.classList.add('selected-pending');
              else b.classList.add('dimmed');
              b.style.pointerEvents = 'none';
            });
          }

          // Timer Bar
          const timerFill = document.getElementById('timer-bar-fill');
          if (timerFill) {
            const pct = Math.max(0, (state.remainingSec / (q.timeLimitSec || 15)) * 100);
            timerFill.style.width = `${pct}%`;
            timerFill.setAttribute('aria-valuenow', String(state.remainingSec));
          }
          const timerClock = document.getElementById('q-timer-clock');
          if (timerClock) timerClock.textContent = `${state.remainingSec}s`;
        }
        break;
      }

      case 'QUESTION_REVEAL': {
        this.showScreen('game');
        this.showGameView('reveal');

        const q = state.question;
        if (state.playerAnswer) this.selectedOption = state.playerAnswer.optionIndex;
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
              resTitle.textContent = 'CORRECT';
              resTitle.style.color = 'var(--orchid)';
            }
            if (resSub) {
              resSub.textContent = `Response Time: ${state.playerAnswer.timeElapsedMs}ms · ${this.player.teamId === 'bit' ? 'Team Bit' : 'Team Build'}`;
            }
          } else {
            if (resBox) resBox.className = 'reveal-card wrong';
            if (resTitle) {
              resTitle.textContent = 'NOT QUITE';
              resTitle.style.color = 'var(--red)';
            }
            if (resSub) {
              resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
            }
          }
        } else {
          if (resBox) resBox.className = 'reveal-card';
          if (resTitle) {
              resTitle.textContent = 'TIME UP';
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
            ? 'YOUR TEAM BUILT IT'
            : 'YOUR TEAM FINISHED SECOND';
        }

        // Populate Top 5 MVPs Leaderboard Table with Accuracy (Correct Count) & Score
        const top5List = document.getElementById('top5-list-mvp');
        if (top5List && state.topContributors && state.winnerTeam) {
          const mvps = state.topContributors[state.winnerTeam] || [];
          top5List.innerHTML = mvps.map((mvp, idx) => {
            const isMe = mvp.id === this.player.id;
            const rankIcon = idx === 0 ? '1ST' : `#${idx + 1}`;
            const correctCount = mvp.correctCount || 0;
            const totalQ = state.totalQuestions || 10;

            return `
              <li class="leaderboard-row ${idx === 0 ? 'rank-1' : ''} ${isMe ? 'is-me' : ''}">
                <span class="rank-col">${rankIcon}</span>
                <span class="name-col">${escapeHtml(mvp.nickname)} ${isMe ? '(YOU)' : ''}</span>
                <span class="accuracy-col">CORRECT: ${correctCount}/${totalQ} (${(mvp.totalResponseTimeMs / 1000).toFixed(1)}s)</span>
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
