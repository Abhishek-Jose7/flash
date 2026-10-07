/**
 * The Amazing Spider-Man 2 Vector Canvas Renderer
 * High-precision 60 FPS HTML5 Canvas engine for the TASM2 emblem.
 * Features:
 * - Crisp blueprint guide lines when locked (no messy dot clusters)
 * - Intense dual-pass laser neon glow (outer chromatic bloom + white-hot core)
 * - Travelling bio-electric sparks along unlocked web lines
 * - High-DPI Retina scaling with compact mobile height adaptation
 */

export class SpiderCanvasRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.themeColor = options.themeColor || '#ff003b';
    this.accentColor = options.accentColor || '#00f0ff';
    this.glowColor = options.glowColor || 'rgba(255, 0, 59, 0.8)';

    this.nodes = [];
    this.edges = [];
    this.unlockedNodeIds = new Set();
    this.unlockedEdges = [];

    // Particle FX
    this.sparks = [];
    this.bursts = [];
    this.animTime = 0;
    this.isRunning = false;

    this.setupResizeHandler();
  }

  setGraphData(nodes, edges) {
    this.nodes = nodes || [];
    this.edges = edges || [];
  }

  setTheme(themeColor, accentColor, glowColor) {
    this.themeColor = themeColor;
    this.accentColor = accentColor;
    this.glowColor = glowColor;
  }

  updateUnlocked(unlockedNodeIds = [], unlockedEdges = []) {
    const nextSet = new Set(unlockedNodeIds);

    // Detect newly unlocked nodes to trigger comic spark bursts
    if (this.nodes.length > 0) {
      for (const id of nextSet) {
        if (!this.unlockedNodeIds.has(id)) {
          const node = this.nodes.find(n => n.id === id);
          if (node) this.spawnBurst(node);
        }
      }
    }

    this.unlockedNodeIds = nextSet;
    this.unlockedEdges = unlockedEdges || [];
  }

  spawnBurst(node) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 25 + Math.random() * 45;
      this.bursts.push({
        x: node.x,
        y: node.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: Math.random() > 0.4 ? this.themeColor : this.accentColor,
        size: 2.5 + Math.random() * 2.5
      });
    }
  }

  setupResizeHandler() {
    this.resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(150, Math.floor(rect.width));
      const displayHeight = Math.max(150, Math.floor(rect.height));

      if (this.canvas.width !== displayWidth * dpr || this.canvas.height !== displayHeight * dpr) {
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
      }
    };

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    let lastTime = performance.now();

    const loop = (now) => {
      if (!this.isRunning) return;
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      this.animTime += dt;

      this.update(dt);
      this.draw();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
  }

  update(dt) {
    // Spawn travelling bio-electric pulses along unlocked edges
    if (this.unlockedEdges.length > 0 && Math.random() < 0.3) {
      const edge = this.unlockedEdges[Math.floor(Math.random() * this.unlockedEdges.length)];
      const n1 = this.nodes.find(n => n.id === edge[0]);
      const n2 = this.nodes.find(n => n.id === edge[1]);
      if (n1 && n2) {
        this.sparks.push({
          from: n1,
          to: n2,
          progress: 0,
          speed: 1.5 + Math.random() * 2.0,
          color: Math.random() > 0.3 ? this.accentColor : '#ffffff'
        });
      }
    }

    // Update travelling sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.progress += s.speed * dt;
      if (s.progress >= 1.0) {
        this.sparks.splice(i, 1);
      }
    }

    // Update burst sparks
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 2.2;
      if (b.life <= 0) {
        this.bursts.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // Coordinate mapping: TASM2 emblem normalized in [0, 1000] x [0, 1000]
    const padding = 12 * (window.devicePixelRatio || 1);
    const usableW = w - padding * 2;
    const usableH = h - padding * 2;
    const scale = Math.min(usableW / 1000, usableH / 1000);
    const offsetX = padding + (usableW - 1000 * scale) / 2;
    const offsetY = padding + (usableH - 1000 * scale) / 2;

    const toX = (x) => offsetX + x * scale;
    const toY = (y) => offsetY + y * scale;

    // 1. Draw LOCKED Blueprint Skeleton (Faint clean aesthetic web)
    ctx.lineWidth = Math.max(1, 1.0 * scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (const [fromId, toId] of this.edges) {
      const isUnlocked = this.unlockedEdges.some(
        e => (e[0] === fromId && e[1] === toId) || (e[0] === toId && e[1] === fromId)
      );
      if (!isUnlocked) {
        const n1 = this.nodes.find(n => n.id === fromId);
        const n2 = this.nodes.find(n => n.id === toId);
        if (n1 && n2) {
          ctx.moveTo(toX(n1.x), toY(n1.y));
          ctx.lineTo(toX(n2.x), toY(n2.y));
        }
      }
    }
    ctx.stroke();

    // 2. Draw UNLOCKED Laser Web Filaments (Dual-Pass Vivid Neon)
    if (this.unlockedEdges.length > 0) {
      // Glow pass
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 14 * scale;
      ctx.strokeStyle = this.themeColor;
      ctx.lineWidth = Math.max(2, 3.2 * scale);
      ctx.beginPath();
      for (const [fromId, toId] of this.unlockedEdges) {
        const n1 = this.nodes.find(n => n.id === fromId);
        const n2 = this.nodes.find(n => n.id === toId);
        if (n1 && n2) {
          ctx.moveTo(toX(n1.x), toY(n1.y));
          ctx.lineTo(toX(n2.x), toY(n2.y));
        }
      }
      ctx.stroke();

      // Sharp white-hot electric core pass
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.3 * scale);
      ctx.stroke();
    }

    // 3. Draw Travelling Bio-Sparks
    for (const s of this.sparks) {
      const curX = s.from.x + (s.to.x - s.from.x) * s.progress;
      const curY = s.from.y + (s.to.y - s.from.y) * s.progress;
      const cx = toX(curX);
      const cy = toY(curY);

      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, 3.2 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Burst Sparks
    for (const b of this.bursts) {
      const cx = toX(b.x);
      const cy = toY(b.y);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(cx, cy, b.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 5. Draw LOCKED Joint Pins (Tiny clean dots, not giant blotches)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (const node of this.nodes) {
      if (!this.unlockedNodeIds.has(node.id)) {
        const cx = toX(node.x);
        const cy = toY(node.y);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, 2.0 * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Draw UNLOCKED Nodes (Ignited neon nodes with pulse rings)
    const pulse = 1 + Math.sin(this.animTime * 5) * 0.18;
    for (const node of this.nodes) {
      if (this.unlockedNodeIds.has(node.id)) {
        const cx = toX(node.x);
        const cy = toY(node.y);
        const baseRadius = Math.max(2.8, 4.2 * scale);

        // Outer glow corona
        ctx.shadowColor = this.themeColor;
        ctx.shadowBlur = 16 * scale;
        ctx.fillStyle = this.themeColor;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * pulse, 0, Math.PI * 2);
        ctx.fill();

        // White hot diamond/circle center
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}
