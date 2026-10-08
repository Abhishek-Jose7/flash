class AdminApp {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.connectTimeout = null;
    this.reconnectAttempts = 0;
    this.adminToken = localStorage.getItem('spider_admin_token') || null;
    this.state = null;

    this.loginSection = document.getElementById('admin-login-section');
    this.dashboardSection = document.getElementById('admin-dashboard-section');

    this.bindEvents();

    if (this.adminToken) {
      this.showDashboard();
      this.connectWebSocket();
    } else {
      this.showLogin();
    }
  }

  showLogin() {
    if (this.loginSection) this.loginSection.style.display = 'block';
    if (this.dashboardSection) this.dashboardSection.style.display = 'none';
  }

  showDashboard() {
    if (this.loginSection) this.loginSection.style.display = 'none';
    if (this.dashboardSection) this.dashboardSection.style.display = 'block';
  }

  bindEvents() {
    // Login form submission
    const btnDoLogin = document.getElementById('btn-do-login');
    const inputPass = document.getElementById('login-password');
    const inputUser = document.getElementById('login-username');

    if (btnDoLogin) {
      const handleLogin = async () => {
        const username = inputUser ? inputUser.value.trim() : 'admin';
        const password = inputPass ? inputPass.value.trim() : '';

        const errorEl = document.getElementById('login-error-msg');
        if (errorEl) errorEl.style.display = 'none';

        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });

          const data = await res.json();
          if (data && data.success) {
            this.adminToken = data.token || password;
            localStorage.setItem('spider_admin_token', this.adminToken);
            this.showDashboard();
            this.connectWebSocket();
          } else {
            if (errorEl) {
              errorEl.textContent = data.message || 'Invalid credentials!';
              errorEl.style.display = 'block';
            }
          }
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = 'Server connection error. Please try again.';
            errorEl.style.display = 'block';
          }
        }
      };

      btnDoLogin.addEventListener('click', handleLogin);
      if (inputPass) {
        inputPass.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleLogin();
        });
      }
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.adminToken = null;
        localStorage.removeItem('spider_admin_token');
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.showLogin();
      });
    }

    // Control buttons
    document.getElementById('btn-start-game')?.addEventListener('click', () => this.sendAction('START_GAME'));
    document.getElementById('btn-next-q')?.addEventListener('click', () => this.sendAction('NEXT_QUESTION'));
    document.getElementById('btn-reveal-ans')?.addEventListener('click', () => this.sendAction('REVEAL_ANSWER'));
    document.getElementById('btn-trigger-win')?.addEventListener('click', () => this.sendAction('TRIGGER_VICTORY'));

    document.getElementById('btn-reset-game')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to RESET the entire flashmob quiz? All player scores and assembled spider nodes will be cleared!')) {
        this.sendAction('RESET_GAME');
      }
    });

    // Tier simulation testing buttons
    document.querySelectorAll('.btn-test-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const tier = parseInt(btn.dataset.tier, 10);
        this.sendAction('UNLOCK_TIER_TEST', { teamId: team, tier });
      });
    });
  }

  connectWebSocket() {
    if (!this.adminToken) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.connectTimeout = setTimeout(() => {
      if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) ws.close();
    }, 10000);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
      this.reconnectAttempts = 0;
      const connStatus = document.getElementById('admin-conn-status');
      if (connStatus) {
        connStatus.textContent = 'ONLINE';
        connStatus.style.color = 'var(--orchid)';
      }
      // Re-authenticate after reconnect so this console keeps receiving full state.
      this.sendAction('AUTH');
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INIT' || msg.type === 'STATE_UPDATE') {
          this.renderState(msg.state);
        } else if (msg.type === 'ERROR') {
          if (msg.code === 'UNAUTHORIZED') {
            alert('Host session expired or unauthorized. Please log in again.');
            this.adminToken = null;
            localStorage.removeItem('spider_admin_token');
            this.showLogin();
            if (this.ws === ws) ws.close();
          } else {
            console.warn('Admin error received:', msg.code);
          }
        }
      } catch (e) {
        console.error('Admin WS parse error:', e);
      }
    };

    ws.onclose = () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      if (this.ws !== ws) return;
      this.ws = null;
      const connStatus = document.getElementById('admin-conn-status');
      if (connStatus) {
        connStatus.textContent = 'RECONNECTING...';
        connStatus.style.color = 'var(--blush)';
      }
      this.scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.warn('Admin WS error:', err);
      if (this.ws === ws && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) ws.close();
    };
  }

  scheduleReconnect() {
    if (!this.adminToken || this.reconnectTimer) return;
    const baseDelay = Math.min(30000, 1000 * (2 ** this.reconnectAttempts));
    const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  sendAction(action, payload = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'ADMIN_ACTION',
        passkey: this.adminToken,
        action,
        payload
      }));
    } else {
      alert('WebSocket not connected. Please check connection.');
    }
  }

  renderState(state) {
    if (!state) return;
    this.state = state;

    const badge = document.getElementById('admin-stage-badge');
    if (badge) badge.textContent = state.stage;

    const playersCount = document.getElementById('admin-players-count');
    if (playersCount) playersCount.textContent = state.onlinePlayers || 0;

    const qIndex = document.getElementById('admin-q-index');
    if (qIndex) qIndex.textContent = `${state.qIndex + 1} / ${state.totalQuestions}`;

    const timerVal = document.getElementById('admin-timer-val');
    if (timerVal) {
      if (state.stage === 'COUNTDOWN') {
        timerVal.textContent = `${state.countdown}s`;
      } else if (state.stage === 'QUESTION_ACTIVE') {
        timerVal.textContent = `${state.remainingSec || 0}s`;
      } else {
        timerVal.textContent = '--';
      }
    }

    const curQ = document.getElementById('admin-cur-q-text');
    if (curQ) {
      if (state.question) {
        curQ.textContent = `[${state.question.difficulty || 'TECH'}] ${state.question.text}`;
      } else {
        curQ.textContent = 'None (In Lobby / Idle)';
      }
    }

    if (state.teams) {
      const bitStats = document.getElementById('admin-bit-stats');
      if (bitStats && state.teams.bit) {
        bitStats.textContent =
          `${state.teams.bit.score.toLocaleString()} Correct Answers | ${state.teams.bit.percent}% Built | ${state.teams.bit.playerCount} Players`;
      }

      const buildStats = document.getElementById('admin-build-stats');
      if (buildStats && state.teams.build) {
        buildStats.textContent =
          `${state.teams.build.score.toLocaleString()} Correct Answers | ${state.teams.build.percent}% Built | ${state.teams.build.playerCount} Players`;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AdminApp();
});
