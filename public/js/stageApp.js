import { sound } from './audioEngine.js';
import { SpiderCanvasRenderer } from './spiderCanvas.js';

class StageApp {
  constructor() {
    this.ws = null;
    this.graphData = null;
    this.milesRenderer = null;
    this.gwenRenderer = null;
    this.state = null;

    this.initCanvases();
    this.bindEvents();
    this.connectWebSocket();
  }

  initCanvases() {
    const milesCanvas = document.getElementById('stage-canvas-miles');
    const gwenCanvas = document.getElementById('stage-canvas-gwen');

    if (milesCanvas) {
      this.milesRenderer = new SpiderCanvasRenderer(milesCanvas, {
        themeColor: '#ff003b',
        accentColor: '#00f0ff',
        glowColor: 'rgba(255, 0, 59, 0.85)'
      });
      this.milesRenderer.start();
    }

    if (gwenCanvas) {
      this.gwenRenderer = new SpiderCanvasRenderer(gwenCanvas, {
        themeColor: '#ff007f',
        accentColor: '#00e5ff',
        glowColor: 'rgba(255, 0, 127, 0.85)'
      });
      this.gwenRenderer.start();
    }
  }

  bindEvents() {
    const soundToggle = document.getElementById('stage-sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        sound.init();
        const isMuted = sound.toggleMute();
        soundToggle.textContent = isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
      });
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      document.getElementById('stage-conn-tag').textContent = 'ONLINE';
      document.getElementById('stage-conn-tag').style.color = '#00ff66';
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INIT') {
          this.graphData = msg.graph;
          if (this.milesRenderer) this.milesRenderer.setGraphData(this.graphData.nodes, this.graphData.edges);
          if (this.gwenRenderer) this.gwenRenderer.setGraphData(this.graphData.nodes, this.graphData.edges);
          this.renderState(msg.state);
        } else if (msg.type === 'STATE_UPDATE') {
          this.renderState(msg.state);
        }
      } catch (e) {
        console.error('Stage WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      document.getElementById('stage-conn-tag').textContent = 'RECONNECTING...';
      document.getElementById('stage-conn-tag').style.color = '#ffcc00';
      setTimeout(() => this.connectWebSocket(), 1500);
    };
  }

  renderState(state) {
    if (!state) return;
    const prevStage = this.state ? this.state.stage : null;
    this.state = state;

    // Crowd count
    const crowdEl = document.getElementById('stage-crowd-count');
    if (crowdEl) crowdEl.textContent = state.onlinePlayers || 0;

    // Update Spider Canvases
    if (state.teams) {
      const bitTeam = state.teams.bit || state.teams.miles;
      const buildTeam = state.teams.build || state.teams.gwen;

      if (this.milesRenderer && bitTeam) {
        this.milesRenderer.updateUnlocked(bitTeam.unlockedNodeIds, bitTeam.unlockedEdges);
      }
      if (this.gwenRenderer && buildTeam) {
        this.gwenRenderer.updateUnlocked(buildTeam.unlockedNodeIds, buildTeam.unlockedEdges);
      }

      // Update Header Stats
      if (bitTeam) {
        document.getElementById('miles-score-display').textContent = bitTeam.score.toLocaleString();
        document.getElementById('miles-pct-display').textContent = `${bitTeam.percent}%`;
        document.getElementById('miles-players-display').textContent = `${bitTeam.playerCount} PLAYERS`;
      }

      if (buildTeam) {
        document.getElementById('gwen-score-display').textContent = buildTeam.score.toLocaleString();
        document.getElementById('gwen-pct-display').textContent = `${buildTeam.percent}%`;
        document.getElementById('gwen-players-display').textContent = `${buildTeam.playerCount} PLAYERS`;
      }
    }

    // Stage Center View
    const centerPanel = document.getElementById('stage-center-content');

    if (state.stage === 'LOBBY') {
      centerPanel.innerHTML = `
        <div style="text-align: center; padding: 15px;">
          <h2 class="chromatic-text" style="font-size: 34px; margin-bottom: 6px;">SCAN QR TO JOIN</h2>
          <div style="font-size: 16px; color: #ffcc00; font-weight: 700; margin-bottom: 12px;">
            ASSEMBLE THE AMAZING SPIDER-MAN
          </div>
          <img src="/api/qr" style="width: 200px; height: 200px; background: rgba(0,0,0,0.7); padding: 8px; border: 2px solid var(--miles-cyan); border-radius: 12px; margin: 0 auto 12px auto; display: block; box-shadow: 0 0 25px rgba(0,240,255,0.4);" alt="Scan QR">
          <p style="font-size: 14px; color: #ccc; max-width: 480px; margin: 0 auto; line-height: 1.4;">
            Point your camera to join your team. Fast Kahoot trivia unlocks nodes on your team's giant spider emblem!
          </p>
        </div>
      `;
    } else if (state.stage === 'COUNTDOWN') {
      sound.playTick(state.countdown === 1);
      centerPanel.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <div style="font-size: 22px; color: #ffcc00; font-weight: 700; letter-spacing: 2px;">
            QUESTION ${state.qIndex + 1} OF ${state.totalQuestions}
          </div>
          <div class="countdown-number" style="font-size: 140px; margin: 10px 0;">
            ${state.countdown}
          </div>
          <div class="chromatic-text" style="font-size: 24px;">GET READY!</div>
        </div>
      `;
    } else if (state.stage === 'QUESTION_ACTIVE') {
      const q = state.question;
      if (q) {
        centerPanel.innerHTML = `
          <div style="width: 100%; padding: 10px 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span class="question-part-tag" style="font-size: 14px;">UNLOCKING: ${q.spiderPart || 'SPIDER NODE'}</span>
              <span class="chromatic-text" style="font-size: 28px; color: #ffcc00;">⏱️ ${state.remainingSec}s</span>
            </div>
            <h2 style="font-size: 26px; text-align: center; margin-bottom: 20px; color: #ffffff;">${q.text}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="mcq-btn red" style="cursor: default; pointer-events: none; padding: 16px;">
                <span style="font-size: 28px;">🕷️</span>
                <span style="font-size: 18px; margin-top: 4px;">${q.options[0]}</span>
              </div>
              <div class="mcq-btn blue" style="cursor: default; pointer-events: none; padding: 16px;">
                <span style="font-size: 28px;">🕸️</span>
                <span style="font-size: 18px; margin-top: 4px;">${q.options[1]}</span>
              </div>
              <div class="mcq-btn yellow" style="cursor: default; pointer-events: none; padding: 16px;">
                <span style="font-size: 28px;">⚡</span>
                <span style="font-size: 18px; margin-top: 4px;">${q.options[2]}</span>
              </div>
              <div class="mcq-btn purple" style="cursor: default; pointer-events: none; padding: 16px;">
                <span style="font-size: 28px;">🌀</span>
                <span style="font-size: 18px; margin-top: 4px;">${q.options[3]}</span>
              </div>
            </div>
          </div>
        `;
      }
    } else if (state.stage === 'QUESTION_REVEAL') {
      const q = state.question;
      const stats = state.questionStats;
      centerPanel.innerHTML = `
        <div style="width: 100%; padding: 15px 20px; text-align: center;">
          <div class="chromatic-text" style="font-size: 32px; color: #00ff66; margin-bottom: 10px;">
            CORRECT ANSWER: ${q ? q.options[q.correctIndex] : ''}
          </div>
          <div style="display: flex; justify-content: center; gap: 30px; margin: 15px 0;">
            <div style="background: rgba(255,0,59,0.2); border: 2px solid var(--bit-red); border-radius: 10px; padding: 10px 20px;">
              <div style="font-size: 14px; color: var(--bit-red); font-weight: 700;">BIT CORRECT</div>
              <div style="font-size: 28px; font-family: var(--font-comic); color: #fff;">${stats ? (stats.bitCorrect ?? stats.milesCorrect ?? 0) : 0}</div>
            </div>
            <div style="background: rgba(255,0,127,0.2); border: 2px solid var(--build-pink); border-radius: 10px; padding: 10px 20px;">
              <div style="font-size: 14px; color: var(--build-pink); font-weight: 700;">BUILD CORRECT</div>
              <div style="font-size: 28px; font-family: var(--font-comic); color: #fff;">${stats ? (stats.buildCorrect ?? stats.gwenCorrect ?? 0) : 0}</div>
            </div>
          </div>
          <div style="font-size: 16px; color: #ffcc00; font-weight: 700;">
            ⚡ Nodes have illuminated on the Spiders! Next question coming up...
          </div>
        </div>
      `;
    } else if (state.stage === 'VICTORY') {
      if (prevStage !== 'VICTORY') sound.playVictory();
      const winTeam = (state.teams && state.winnerTeam && state.teams[state.winnerTeam]) || { name: 'CHAMPIONS', themeColor: '#ffd700' };
      const mvps = (state.topContributors && state.topContributors[state.winnerTeam]) || [];

      centerPanel.innerHTML = `
        <div style="width: 100%; padding: 20px; text-align: center;">
          <h1 class="chromatic-text chromatic-glitch" style="font-size: 46px; margin-bottom: 8px; color: ${winTeam.themeColor || '#ffd700'};">
            🏆 ${winTeam.name ? winTeam.name.toUpperCase() : 'TEAM WINS'}! 🏆
          </h1>
          <div style="font-size: 20px; color: #ffd700; font-weight: 700; margin-bottom: 20px;">
            THE AMAZING SPIDER-MAN IS FULLY ASSEMBLED!
          </div>

          <div style="background: rgba(0,0,0,0.7); border: 3px solid #ffd700; border-radius: 16px; padding: 16px; max-width: 700px; margin: 0 auto;">
            <h2 style="font-family: var(--font-comic); font-size: 26px; color: #ffd700; margin-bottom: 12px;">
              ⭐ TOP 5 MVPs OF THE WINNING TEAM ⭐
            </h2>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${mvps.map((p, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.06); padding: 10px 16px; border-radius: 8px; border-left: 4px solid #ffd700;">
                  <span style="font-family: var(--font-comic); font-size: 22px; color: #ffd700; width: 40px; text-align: left;">#${idx + 1}</span>
                  <span style="font-size: 18px; font-weight: 700; flex: 1; text-align: left;">${p.nickname}</span>
                  <span style="font-size: 14px; color: #aaa; margin-right: 15px;">${p.correctCount} Correct</span>
                  <span style="font-family: var(--font-comic); font-size: 22px; color: var(--miles-cyan);">${p.score.toLocaleString()} PTS</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new StageApp();
});
