/**
 * Authentic Marvel Spider-Man Emblem Vector Engine
 * High-performance 60 FPS HTML5 Canvas renderer using official Spider-Man vector silhouette.
 */

const REVEAL_REGIONS = [
  { type: 'oval', x: 24, y: 39, rx: 6, ry: 16 }, // 1: Body
  { type: 'oval', x: 24, y: 16, rx: 5, ry: 7 },  // 2: Head
  { type: 'rect', rect: [0, 0, 24, 22] },        // 3: Top Left Leg
  { type: 'rect', rect: [24, 0, 24, 22] },       // 4: Top Right Leg
  { type: 'rect', rect: [0, 22, 24, 12] },       // 5: Mid Left Leg
  { type: 'rect', rect: [24, 22, 24, 12] },      // 6: Mid Right Leg
  { type: 'rect', rect: [0, 34, 24, 12] },       // 7: Low Left Leg
  { type: 'rect', rect: [24, 34, 24, 12] },      // 8: Low Right Leg
  { type: 'rect', rect: [0, 46, 24, 19] },       // 9: Bottom Left Leg
  { type: 'rect', rect: [24, 46, 24, 19] }       // 10: Bottom Right Leg
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
    this.img.src = '/img/spider-emblem.svg';
    this.imgLoaded = false;
    this.img.onload = () => { this.imgLoaded = true; };

    this.isRunning = false;
    this.frameId = 0;
    this.lastFrameTime = 0;
    this.handleVisibilityChange = () => {
      if (document.hidden) {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        this.frameId = 0;
      } else {
        this.scheduleDraw();
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

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
    this.targetPercent = Math.min(100, Math.round((count / 10) * 100));
    this.unlockedTier = Math.min(10, Math.ceil(this.targetPercent / 10));
    this.scheduleDraw();
  }

  setProgress(percent) {
    this.targetPercent = Math.max(0, Math.min(100, percent));
    this.unlockedTier = Math.min(10, Math.ceil(this.targetPercent / 10));
    this.scheduleDraw();
  }

  setupResizeHandler() {
    this.resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(100, Math.floor(rect.width));
      const displayHeight = Math.max(100, Math.floor(rect.height));

      if (this.canvas.width !== displayWidth * dpr || this.canvas.height !== displayHeight * dpr) {
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.scheduleDraw();
      }
    };
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleDraw();
  }

  scheduleDraw() {
    if (!this.isRunning || document.hidden || this.frameId) return;
    this.frameId = requestAnimationFrame((now) => {
      this.frameId = 0;
      const dt = this.lastFrameTime ? Math.min(0.1, (now - this.lastFrameTime) / 1000) : 1 / 60;
      this.lastFrameTime = now;
      const remaining = this.targetPercent - this.percent;
      this.percent = Math.abs(remaining) < 0.05
        ? this.targetPercent
        : this.percent + remaining * Math.min(1, dt * 5);
      this.draw();
      if (this.percent !== this.targetPercent) this.scheduleDraw();
    });
  }

  stop() {
    this.isRunning = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const padding = 4 * (window.devicePixelRatio || 1);
    const usableW = w - padding * 2;
    const usableH = h - padding * 2;

    const scale = Math.min(usableW / 48, usableH / 65);
    const offsetX = padding + (usableW - 48 * scale) / 2;
    const offsetY = padding + (usableH - 65 * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (this.imgLoaded) {
      for (let i = 0; i < 10; i++) {
        const tierStart = i * 10;
        const opacity = Math.max(0, Math.min(1, (this.percent - tierStart) / 10));
        
        if (opacity > 0) {
          const r = REVEAL_REGIONS[i];
          ctx.save();
          ctx.beginPath();
          if (r.type === 'oval') {
            ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
          } else if (r.type === 'circle') {
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          } else if (r.type === 'rect') {
            ctx.rect(r.rect[0], r.rect[1], r.rect[2], r.rect[3]);
          }
          ctx.clip();
          
          ctx.globalAlpha = opacity;
          ctx.filter = 'brightness(0.0)';
          ctx.drawImage(this.img, 0, 0, 48, 65);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
