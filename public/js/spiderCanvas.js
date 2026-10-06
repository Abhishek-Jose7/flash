/**
 * High-Performance 60 FPS HTML5 Canvas Spider Graph Visualizer
 * Renders The Amazing Spider-Man logo as connected nodes & laser web filaments
 * Features: High-DPI retina scaling, electric pulse particles, chromatic glow
 */

export class SpiderCanvasRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.themeColor = options.themeColor || '#ff003b';
    this.accentColor = options.accentColor || '#00f0ff';
    this.glowColor = options.glowColor || 'rgba(255, 0, 59, 0.7)';

    this.nodes = [];
    this.edges = [];
    this.unlockedNodeIds = new Set();
    this.unlockedEdges = [];

    // Animation state
    this.particles = [];       // Travelling electric pulses along edges
    this.burstParticles = [];  // Spark explosions on newly unlocked nodes
    this.prevUnlockedCount = 0;
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

    // Detect newly unlocked nodes to trigger comic spark explosions
    if (this.nodes.length > 0) {
      for (const id of nextSet) {
        if (!this.unlockedNodeIds.has(id)) {
          const node = this.nodes.find(n => n.id === id);
          if (node) this.spawnNodeBurst(node);
        }
      }
    }

    this.unlockedNodeIds = nextSet;
    this.unlockedEdges = unlockedEdges || [];
  }

  spawnNodeBurst(node) {
    const burstCount = 12;
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5);
      const speed = 2 + Math.random() * 4;
      this.burstParticles.push({
        x: node.x,
        y: node.y,
        vx: Math.cos(angle) * speed * 25,
        vy: Math.sin(angle) * speed * 25,
        life: 1.0,
        color: Math.random() > 0.5 ? this.themeColor : this.accentColor,
        size: 2 + Math.random() * 3
      });
    }
  }

  setupResizeHandler() {
    this.resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(200, Math.floor(rect.width));
      const displayHeight = Math.max(200, Math.floor(rect.height));

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
    // Spawn travelling electric pulse particles on unlocked edges
    if (this.unlockedEdges.length > 0 && Math.random() < 0.25) {
      const edge = this.unlockedEdges[Math.floor(Math.random() * this.unlockedEdges.length)];
      const n1 = this.nodes.find(n => n.id === edge[0]);
      const n2 = this.nodes.find(n => n.id === edge[1]);
      if (n1 && n2) {
        this.particles.push({
          from: n1,
          to: n2,
          progress: 0,
          speed: 1.2 + Math.random() * 1.5,
          color: Math.random() > 0.3 ? this.accentColor : '#ffffff'
        });
      }
    }

    // Update travelling particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed * dt;
      if (p.progress >= 1.0) {
        this.particles.splice(i, 1);
      }
    }

    // Update burst particles
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const bp = this.burstParticles[i];
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      bp.life -= dt * 1.8;
      if (bp.life <= 0) {
        this.burstParticles.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // Coordinate transformation: map [0, 1000] -> canvas pixels with padding
    const padding = 20 * (window.devicePixelRatio || 1);
    const usableW = w - padding * 2;
    const usableH = h - padding * 2;
    const scale = Math.min(usableW / 1000, usableH / 1000);
    const offsetX = padding + (usableW - 1000 * scale) / 2;
    const offsetY = padding + (usableH - 1000 * scale) / 2;

    const toCanvasX = (x) => offsetX + x * scale;
    const toCanvasY = (y) => offsetY + y * scale;

    // 1. Draw LOCKED Edges (Faint blueprint grid)
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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
          ctx.moveTo(toCanvasX(n1.x), toCanvasY(n1.y));
          ctx.lineTo(toCanvasX(n2.x), toCanvasY(n2.y));
        }
      }
    }
    ctx.stroke();

    // 2. Draw UNLOCKED Edges (Laser web filaments with chromatic glow)
    if (this.unlockedEdges.length > 0) {
      // Glow pass
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 12 * scale;
      ctx.strokeStyle = this.themeColor;
      ctx.lineWidth = Math.max(2, 3.2 * scale);
      ctx.beginPath();
      for (const [fromId, toId] of this.unlockedEdges) {
        const n1 = this.nodes.find(n => n.id === fromId);
        const n2 = this.nodes.find(n => n.id === toId);
        if (n1 && n2) {
          ctx.moveTo(toCanvasX(n1.x), toCanvasY(n1.y));
          ctx.lineTo(toCanvasX(n2.x), toCanvasY(n2.y));
        }
      }
      ctx.stroke();

      // Sharp core pass
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      ctx.stroke();
    }

    // 3. Draw Travelling Web Sparks
    for (const p of this.particles) {
      const curX = p.from.x + (p.to.x - p.from.x) * p.progress;
      const curY = p.from.y + (p.to.y - p.from.y) * p.progress;
      const cx = toCanvasX(curX);
      const cy = toCanvasY(curY);

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, 3.5 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Burst Particles
    for (const bp of this.burstParticles) {
      const cx = toCanvasX(bp.x);
      const cy = toCanvasY(bp.y);
      ctx.fillStyle = bp.color;
      ctx.globalAlpha = Math.max(0, bp.life);
      ctx.shadowBlur = 8 * scale;
      ctx.shadowColor = bp.color;
      ctx.beginPath();
      ctx.arc(cx, cy, bp.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 5. Draw LOCKED Nodes (Translucent dots)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (const node of this.nodes) {
      if (!this.unlockedNodeIds.has(node.id)) {
        const cx = toCanvasX(node.x);
        const cy = toCanvasY(node.y);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, 2.8 * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Draw UNLOCKED Nodes (Ignited neon nodes with pulse rings)
    const pulseScale = 1 + Math.sin(this.animTime * 4) * 0.15;
    for (const node of this.nodes) {
      if (this.unlockedNodeIds.has(node.id)) {
        const cx = toCanvasX(node.x);
        const cy = toCanvasY(node.y);
        const baseRadius = Math.max(3, 4.8 * scale);

        // Outer glow
        ctx.shadowColor = this.themeColor;
        ctx.shadowBlur = 16 * scale;
        ctx.fillStyle = this.themeColor;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        // Inner white hot core
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
