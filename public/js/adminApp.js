class AdminApp {
  constructor() {
    this.ws = null;
    this.passkey = localStorage.getItem('spider_admin_key') || 'spiderverse';
    this.state = null;

    this.bindEvents();
    this.connectWebSocket();
  }

  bindEvents() {
    const inputKey = document.getElementById('admin-passkey');
    if (inputKey) {
      inputKey.value = this.passkey;
      inputKey.addEventListener('change', () => {
        this.passkey = inputKey.value.trim();
        localStorage.setItem('spider_admin_key', this.passkey);
      });
    }

    // Action buttons
    document.getElementById('btn-start-game')?.addEventListener('click', () => this.sendAction('START_GAME'));
    document.getElementById('btn-next-q')?.addEventListener('click', () => this.sendAction('NEXT_QUESTION'));
    document.getElementById('btn-reveal-ans')?.addEventListener('click', () => this.sendAction('REVEAL_ANSWER'));
    document.getElementById('btn-trigger-win')?.addEventListener('click', () => this.sendAction('TRIGGER_VICTORY'));

    document.getElementById('btn-reset-game')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to RESET the entire flashmob game? All scores will be cleared!')) {
        this.sendAction('RESET_GAME');
      }
    });

    // Tier unlock testing buttons
    document.querySelectorAll('.btn-test-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const tier = parseInt(btn.dataset.tier, 10);
        this.sendAction('UNLOCK_TIER_TEST', { teamId: team, tier });
      });
    });
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      document.getElementById('admin-conn-status').textContent = 'ONLINE';
      document.getElementById('admin-conn-status').style.color = '#00ff66';
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INIT' || msg.type === 'STATE_UPDATE') {
          this.renderState(msg.state);
        } else if (msg.type === 'ERROR') {
          alert(`Server Error: ${msg.code || 'ACTION FAILED'}`);
        }
      } catch (e) {
        console.error('Admin WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      document.getElementById('admin-conn-status').textContent = 'RECONNECTING...';
      document.getElementById('admin-conn-status').style.color = '#ffcc00';
      setTimeout(() => this.connectWebSocket(), 1500);
    };
  }

  sendAction(action, payload = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'ADMIN_ACTION',
        passkey: this.passkey,
        action,
        payload
      }));
    } else {
      alert('WebSocket not connected!');
    }
  }

  renderState(state) {
    if (!state) return;
    this.state = state;

    document.getElementById('admin-stage-display').textContent = state.stage;
    document.getElementById('admin-q-index').textContent = `${state.qIndex + 1} / ${state.totalQuestions}`;
    document.getElementById('admin-players-count').textContent = state.onlinePlayers || 0;

    if (state.question) {
      document.getElementById('admin-cur-q-text').textContent = state.question.text;
    } else {
      document.getElementById('admin-cur-q-text').textContent = 'None (In Lobby / Idle)';
    }

    if (state.teams) {
      document.getElementById('admin-miles-stats').textContent =
        `${state.teams.miles.score} PTS | ${state.teams.miles.percent}% Spider Built | ${state.teams.miles.playerCount} Players`;

      document.getElementById('admin-gwen-stats').textContent =
        `${state.teams.gwen.score} PTS | ${state.teams.gwen.percent}% Spider Built | ${state.teams.gwen.playerCount} Players`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AdminApp();
});
