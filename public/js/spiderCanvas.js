/**
 * Authentic Marvel Spider-Man Emblem Vector Engine
 * High-performance 60 FPS HTML5 Canvas renderer using official Spider-Man vector silhouette.
 * Features:
 * - Authentic Marvel Spider-Man chest emblem path
 * - Progressive laser energy fill as team answers correctly
 * - Laser web filament surge lines and bio-electric sparks
 * - Glowing joint nodes that ignite tier-by-tier
 * - Responsive Retina high-DPI scaling
 */

const SPIDER_PATH_D = "";

// Nodes mapped to the Spidey Head image
const EMBLEM_JOINTS = [
  { id: 0, x: 24, y: 10, tier: 1, label: 'Alert Center' },
  { id: 1, x: 14, y: 18, tier: 2, label: 'Alert Left' },
  { id: 2, x: 34, y: 18, tier: 2, label: 'Alert Right' },
  { id: 3, x: 24, y: 30, tier: 3, label: 'Forehead' },
  { id: 4, x: 12, y: 40, tier: 4, label: 'Left Eye Top' },
  { id: 5, x: 36, y: 40, tier: 4, label: 'Right Eye Top' },
  { id: 6, x: 16, y: 52, tier: 5, label: 'Left Eye Bottom' },
  { id: 7, x: 32, y: 52, tier: 5, label: 'Right Eye Bottom' },
  { id: 8, x: 8,  y: 46, tier: 6, label: 'Left Jaw' },
  { id: 9, x: 40, y: 46, tier: 6, label: 'Right Jaw' },
  { id: 10, x: 24, y: 58, tier: 7, label: 'Chin' },
  { id: 11, x: 24, y: 65, tier: 8, label: 'Neck base' }
];

export class SpiderCanvasRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.themeColor = options.themeColor || '#E3212A';
    this.accentColor = options.accentColor || '#F4F6F8';
    this.glowColor = options.glowColor || 'rgba(227, 33, 42, 0.78)';

    this.percent = 0;
    this.targetPercent = 0;
    this.unlockedTier = 0;

    // Load the actual user image
    this.img = new Image();
    this.img.src = '/img/spider-alert.png';
    this.imgLoaded = false;
    this.img.onload = () => { this.imgLoaded = true; };

    this.sparks = [];
    this.animTime = 0;
    this.isRunning = false;

    this.setupResizeHandler();
  }

  setTheme(themeColor, accentColor, glowColor) {
    this.themeColor = themeColor;
    this.accentColor = accentColor;
    this.glowColor = glowColor;
  }

  setGraphData() {}

  updateUnlocked(unlockedNodeIds = [], unlockedEdges = []) {
    const count = Array.isArray(unlockedNodeIds) ? unlockedNodeIds.length : (unlockedNodeIds.size || 0);
    this.targetPercent = Math.min(100, Math.round((count / 48) * 100));
    this.unlockedTier = Math.min(8, Math.ceil(this.targetPercent / 12.5));
  }

  setProgress(percent) {
    this.targetPercent = Math.max(0, Math.min(100, percent));
    this.unlockedTier = Math.min(8, Math.ceil(this.targetPercent / 12.5));
  }

  setupResizeHandler() {
    this.resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(120, Math.floor(rect.width));
      const displayHeight = Math.max(120, Math.floor(rect.height));

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
      this.percent += (this.targetPercent - this.percent) * Math.min(1, dt * 5);
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
    if (this.percent > 0 && Math.random() < 0.25) {
      const p1 = EMBLEM_JOINTS[Math.floor(Math.random() * EMBLEM_JOINTS.length)];
      const p2 = EMBLEM_JOINTS[Math.floor(Math.random() * EMBLEM_JOINTS.length)];
      if (p1 && p2 && p1.id !== p2.id) {
        this.sparks.push({
          x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y,
          progress: 0,
          speed: 1.8 + Math.random() * 2.0,
          color: Math.random() > 0.4 ? this.themeColor : '#ffffff'
        });
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.progress += s.speed * dt;
      if (s.progress >= 1.0) {
        this.sparks.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const padding = 16 * (window.devicePixelRatio || 1);
    const usableW = w - padding * 2;
    const usableH = h - padding * 2;

    const scale = Math.min(usableW / 48, usableH / 65);
    const offsetX = padding + (usableW - 48 * scale) / 2;
    const offsetY = padding + (usableH - 65 * scale) / 2;

    const toX = (vx) => offsetX + vx * scale;
    const toY = (vy) => offsetY + vy * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (this.imgLoaded) {
      // Draw faded base image
      ctx.globalAlpha = 0.15;
      ctx.drawImage(this.img, 0, 0, 48, 65);
      
      // Draw revealed image
      if (this.percent > 0) {
        ctx.save();
        ctx.globalAlpha = 1.0;
        const revealH = (this.percent / 100) * 65;
        ctx.beginPath();
        ctx.rect(0, 65 - revealH, 48, revealH);
        ctx.clip();
        ctx.drawImage(this.img, 0, 0, 48, 65);
        ctx.restore();
        
        // Active horizon bar
        const horizonY = 65 - revealH;
        if (horizonY > 0 && horizonY < 65) {
          ctx.shadowColor = this.themeColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = this.themeColor;
          ctx.lineWidth = 1.4 / scale;
          ctx.beginPath();
          ctx.moveTo(0, horizonY);
          ctx.lineTo(48, horizonY);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    const currentTier = Math.ceil((this.percent / 100) * 8);

    for (const s of this.sparks) {
      const cx = toX(s.x1 + (s.x2 - s.x1) * s.progress);
      const cy = toY(s.y1 + (s.y2 - s.y1) * s.progress);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, 2 * (scale / 4)), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const joint of EMBLEM_JOINTS) {
      const isLit = joint.tier <= currentTier && this.percent > 0;
      const jx = toX(joint.x);
      const jy = toY(joint.y);

      if (isLit) {
        ctx.shadowColor = this.themeColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = this.themeColor;
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(2, 3 * (scale / 4)), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(1, 1.5 * (scale / 4)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}
