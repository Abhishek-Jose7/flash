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

    // Canvas visualizer instance
    this.spiderRenderer = null;

    // DOM Elements
    this.screens = {
      join: document.getElementById('screen-join'),
      lobby: document.getElementById('screen-lobby'),
      countdown: document.getElementById('screen-countdown'),
      question: document.getElementById('screen-question'),
      result: document.getElementById('screen-result'),
      victory: document.getElementById('screen-victory')
    };

    this.bindEvents();
    this.initCanvas();
    this.connectWebSocket();
  }

  getOrCreatePlayerId() {
    let id = localStorage.getItem('spider_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
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
    // Join button
    const btnJoin = document.getElementById('btn-join');
    const inputNick = document.getElementById('input-nick');
    if (btnJoin && inputNick) {
      if (this.nickname) inputNick.value = this.nickname;

      const submitJoin = () => {
        sound.init();
        sound.playThwip();
        this.nickname = inputNick.value.trim() || 'Spider-Slinger';
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
      btn.addEventListener('click', () => {
        const opt = parseInt(btn.dataset.opt, 10);
        this.submitAnswer(opt);
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
      document.getElementById('conn-status').textContent = '⚡ CONNECTED';
      document.getElementById('conn-status').style.color = '#00ff66';

      // Re-join if we already have identity
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
      document.getElementById('conn-status').textContent = '⚠️ RECONNECTING...';
      document.getElementById('conn-status').style.color = '#ffcc00';
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

  submitAnswer(opt) {
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

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBMIT_ANSWER',
        questionId: this.state.question.id,
        optionIndex: opt
      }));
    }
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

    // Apply team theme to body
    document.body.className = `team-${this.player.teamId}`;

    const teamNameEl = document.getElementById('user-team-name');
    const userScoreEl = document.getElementById('user-score-val');
    const userNickEl = document.getElementById('user-nick-display');

    if (teamNameEl) {
      teamNameEl.textContent = this.player.teamId === 'miles' ? 'MILES MORALES' : 'SPIDER-GWEN';
      teamNameEl.style.color = this.player.teamId === 'miles' ? '#ff003b' : '#ff007f';
    }
    if (userScoreEl) userScoreEl.textContent = this.player.score.toLocaleString();
    if (userNickEl) userNickEl.textContent = this.player.nickname;

    if (this.spiderRenderer) {
      if (this.player.teamId === 'miles') {
        this.spiderRenderer.setTheme('#ff003b', '#00f0ff', 'rgba(255, 0, 59, 0.8)');
      } else {
        this.spiderRenderer.setTheme('#ff007f', '#00f0ff', 'rgba(255, 0, 127, 0.8)');
      }
    }
  }

  updateState(state) {
    if (!state) return;
    const prevStage = this.state ? this.state.stage : null;
    this.state = state;

    if (state.player) {
      this.player = state.player;
      this.updatePlayerUI();
    }

    // Update Spider Canvas for player's team
    if (this.spiderRenderer && this.player && state.teams) {
      const myTeam = state.teams[this.player.teamId];
      if (myTeam) {
        this.spiderRenderer.updateUnlocked(myTeam.unlockedNodeIds, myTeam.unlockedEdges);
      }
    }

    // Update Team Progress Ribbons
    if (state.teams) {
      const milesFill = document.getElementById('miles-bar-fill');
      const milesVal = document.getElementById('miles-pct-val');
      const gwenFill = document.getElementById('gwen-bar-fill');
      const gwenVal = document.getElementById('gwen-pct-val');

      if (milesFill) milesFill.style.width = `${state.teams.miles.percent}%`;
      if (milesVal) milesVal.textContent = `${state.teams.miles.percent}% (${state.teams.miles.score} PTS)`;

      if (gwenFill) gwenFill.style.width = `${state.teams.gwen.percent}%`;
      if (gwenVal) gwenVal.textContent = `${state.teams.gwen.percent}% (${state.teams.gwen.score} PTS)`;
    }

    // Stage Routing
    this.renderStage(state, prevStage);
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      if (el) {
        if (key === name) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    }
  }

  renderStage(state, prevStage) {
    // If player is not registered yet, stay on join screen
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
        this.showScreen('countdown');
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
        this.showScreen('question');
        const q = state.question;
        if (q) {
          document.getElementById('q-part-tag').textContent = `PART: ${q.spiderPart || 'SPIDER NODE'}`;
          document.getElementById('q-text').textContent = q.text;

          // Render Options
          const btns = document.querySelectorAll('.mcq-btn');
          btns.forEach((btn, idx) => {
            const label = btn.querySelector('.mcq-label');
            if (label && q.options[idx]) {
              label.textContent = q.options[idx];
            }
            // Reset selection state
            btn.classList.remove('selected', 'dimmed', 'correct-highlight');
          });

          // If player already answered (reconnect)
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
        this.showScreen('result');
        const q = state.question;
        const resTitle = document.getElementById('reveal-title');
        const resSub = document.getElementById('reveal-sub');
        const resBox = document.getElementById('reveal-box');

        if (state.playerAnswer) {
          if (state.playerAnswer.isCorrect) {
            resBox.className = 'reveal-box correct';
            resTitle.textContent = '⚡ THWIP! CORRECT!';
            resTitle.style.color = '#00ff66';
            resSub.textContent = `+${state.playerAnswer.points} Points added to ${this.player.teamId === 'miles' ? 'Team Miles' : 'Team Gwen'}!`;
          } else {
            resBox.className = 'reveal-box';
            resTitle.textContent = '🕸️ MISSED!';
            resTitle.style.color = '#ff003b';
            resSub.textContent = `Correct answer was: "${q ? q.options[q.correctIndex] : ''}"`;
          }
        } else {
          resBox.className = 'reveal-box';
          resTitle.textContent = '⏳ TIME UP!';
          resTitle.style.color = '#ffcc00';
          resSub.textContent = `Correct answer: "${q ? q.options[q.correctIndex] : ''}"`;
        }
        break;
      }

      case 'VICTORY': {
        this.showScreen('victory');
        sound.playVictory();

        const winBanner = document.getElementById('victory-team-banner');
        const isWinner = state.winnerTeam === this.player.teamId;

        if (winBanner) {
          const winName = state.winnerTeam === 'miles' ? 'TEAM MILES MORALES' : 'TEAM SPIDER-GWEN';
          winBanner.textContent = `${winName} WINS!`;
          winBanner.style.color = state.winnerTeam === 'miles' ? '#ff003b' : '#ff007f';
        }

        const winSub = document.getElementById('victory-sub-banner');
        if (winSub) {
          winSub.textContent = isWinner
            ? '🏆 YOUR TEAM FULLY ASSEMBLED THE AMAZING SPIDER-MAN!'
            : '🕸️ GLORIOUS BATTLE! The Multiverse is saved!';
        }

        // Render Top 5 MVPs for the winning team
        const top5List = document.getElementById('top5-list-mvp');
        if (top5List && state.topContributors && state.winnerTeam) {
          const mvps = state.topContributors[state.winnerTeam] || [];
          top5List.innerHTML = mvps.map((mvp, idx) => `
            <li class="top5-item ${idx === 0 ? 'rank-1' : ''}">
              <span class="top5-rank">#${idx + 1}</span>
              <span class="top5-name">${mvp.nickname} ${mvp.id === this.player.id ? '⭐ (YOU)' : ''}</span>
              <span class="top5-score">${mvp.score.toLocaleString()} PTS</span>
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

// Start player app
window.addEventListener('DOMContentLoaded', () => {
  new PlayerApp();
});
