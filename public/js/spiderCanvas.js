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

const SPIDER_PATH_D = "M19.5 26.136c-5.917-.325-9.203-.24-14.989.559-.645-6.605.205-9.883 3.617-15.063-1.743 4.52-2.08 8.883-1.156 12.602 5.012-.03 7.718.194 12.527.634l.224-.634c-3.781-2.041-5.876-3.15-8.016-3.58-.795-9.216-.084-13.872 4.884-20.542-2.966 7.999-3.429 12.143-2.274 18.977l6.189 4.325.484-.56-1.64-1.752c.862-1.324 1.525-1.783 2.87-2.349-.47.526-.66.957-.894 2.126.297.63.502.806.895 1.006h2.46c.55-.19.776-.372 1.082-.783.271-.464.097-.979-.783-2.349 1.143.541 1.777.916 2.833 2.35l-1.603 1.752.522.596 6.152-4.287c.99-6.986.89-11.074-2.312-19.164 5.917 8.845 5.588 12.902 5.051 19.537l-.092 1.155c-1.926.368-3.753 1.216-8.128 3.691l.298.485c4.581-.56 7.362-.66 12.565-.597 1.032-4.029.423-7.014-1.156-12.639 3.494 5.663 4.28 8.957 3.617 15.063-6.222-.968-9.43-.95-15.026-.671l-.149.559c6.609.663 19.686 4.064 19.686 4.064-1.874 16.185-6.453 21.849-13.342 30.37-.838 1.036-1.71 2.114-2.615 3.26.499-.8.984-1.568 1.454-2.313 5.553-8.797 9.08-14.385 10.066-29.565-5.286-2.06-8.842-3.13-15.696-4.959l-.224.373c6.383 3.074 9.924 4.781 12.826 6.413-.45 11.184-2.698 15.593-6.38 22.811l-.63 1.237c.151-.427.299-.839.442-1.24 2.086-5.834 3.383-9.461 3.734-21.988-3.546-2.422-5.728-3.67-8.965-5.52l-1.362-.78-.15.298 5.108 3.69c.207 3.758.254 5.568 0 7.345-1.202 2.627-3.008 4.302-7.792 7.569-3.235-1.596-4.995-2.956-7.904-7.382-.35-2.445-.412-3.99-.15-7.233 1.85-1.729 2.962-2.594 5.072-3.952l-.15-.298c-4.243 2.324-6.47 3.677-10.253 6.151-.003 11.366 1.4 15.897 4.474 23.228-.196-.333-.39-.656-.578-.974-3.498-5.873-5.63-9.452-6.73-22.888l12.752-6.263-.261-.597-.316.077c-6.257 1.512-9.861 2.383-15.157 4.92 1.648 17.538 5.054 22.928 11.52 31.84C5.817 53.873 2.813 47.61 0 30.608l19.648-3.952-.149-.521Zm.67 4.175c-1.242 1.025-1.916 1.617-3.057 2.722-.057 1.983-.014 3.25.335 6.077 1.663 2.823 3.134 4.116 6.227 6.152 3.29-2.324 4.88-3.648 5.965-6.152.378-1.614.481-2.922.447-6.077l-2.945-2.722 1.976 2.908c.139 2.036.087 3.124-.447 4.884-1.636 2.558-2.76 3.506-4.996 4.66-2.319-1.09-3.367-2.11-4.996-4.324-.465-1.563-.563-2.715-.671-4.884l2.162-3.244Z";

// Joint nodes placed across the authentic anatomy (Head, Thorax, 4 Upper Legs, 4 Lower Legs)
const EMBLEM_JOINTS = [
  { id: 0, x: 24, y: 5,  tier: 1, label: 'Head' },
  { id: 1, x: 20, y: 14, tier: 1, label: 'Left Fang' },
  { id: 2, x: 28, y: 14, tier: 1, label: 'Right Fang' },
  { id: 3, x: 24, y: 22, tier: 2, label: 'Thorax Core' },
  { id: 4, x: 24, y: 32, tier: 2, label: 'Heart' },
  { id: 5, x: 24, y: 44, tier: 3, label: 'Abdomen' },
  { id: 6, x: 24, y: 58, tier: 3, label: 'Spine Tip' },
  // Upper Legs (High Arches)
  { id: 7, x: 12, y: 8,  tier: 4, label: 'Upper L1 Arch' },
  { id: 8, x: 36, y: 8,  tier: 4, label: 'Upper R1 Arch' },
  { id: 9, x: 4,  y: 20, tier: 5, label: 'Talon L1' },
  { id: 10, x: 44, y: 20, tier: 5, label: 'Talon R1' },
  { id: 11, x: 14, y: 24, tier: 5, label: 'Upper L2' },
  { id: 12, x: 34, y: 24, tier: 5, label: 'Upper R2' },
  // Lower Legs (Elongated Fangs)
  { id: 13, x: 15, y: 38, tier: 6, label: 'Lower L1' },
  { id: 14, x: 33, y: 38, tier: 6, label: 'Lower R1' },
  { id: 15, x: 7,  y: 52, tier: 7, label: 'Lower Fang L' },
  { id: 16, x: 41, y: 52, tier: 7, label: 'Lower Fang R' },
  { id: 17, x: 14, y: 62, tier: 8, label: 'Rear Claw L' },
  { id: 18, x: 34, y: 62, tier: 8, label: 'Rear Claw R' }
];

export class SpiderCanvasRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.themeColor = options.themeColor || '#ff003b';
    this.accentColor = options.accentColor || '#00f0ff';
    this.glowColor = options.glowColor || 'rgba(255, 0, 59, 0.85)';

    this.percent = 0;
    this.targetPercent = 0;
    this.unlockedTier = 0;

    this.path2D = null;
    try {
      this.path2D = new Path2D(SPIDER_PATH_D);
    } catch (e) {
      console.warn('Path2D not supported, fallback active');
    }

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

  setGraphData() {
    // Retained for compatibility
  }

  updateUnlocked(unlockedNodeIds = [], unlockedEdges = []) {
    // Compute current progress percent based on unlocked nodes / tiers
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

      // Smooth percentage easing
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
    // Periodically spawn travelling electric sparks along the spider limbs
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

    // Update sparks
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

    // Coordinate mapping: Spider emblem viewBox is 0 0 48 65
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

    if (this.path2D) {
      // 1. BASE OUTLINE: Sleek, stealth silhouette outline
      ctx.lineWidth = 1.0 / scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillStyle = 'rgba(18, 12, 28, 0.6)';
      ctx.fill(this.path2D);
      ctx.stroke(this.path2D);

      // 2. UNLOCKED LASER FILL & BIO-ELECTRIC SURGE
      if (this.percent > 0) {
        ctx.save();

        // Progressive reveal clip: Wipe from center / bottom according to progress
        const revealH = (this.percent / 100) * 65;
        ctx.beginPath();
        ctx.rect(0, 65 - revealH, 48, revealH);
        ctx.clip();

        // Intense neon glow fill
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = this.themeColor;
        ctx.fill(this.path2D);

        // Core white-hot laser energy highlight
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8 / scale;
        ctx.stroke(this.path2D);

        ctx.restore();

        // Active laser horizon bar at the unlock threshold
        const horizonY = 65 - revealH;
        if (horizonY > 0 && horizonY < 65) {
          ctx.shadowColor = this.accentColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4 / scale;
          ctx.beginPath();
          ctx.moveTo(0, horizonY);
          ctx.lineTo(48, horizonY);
          ctx.stroke();
        }
      }
    }

    ctx.restore();

    // 3. DRAW LASER SPIDER JOINTS & BIO-SPARKS
    const currentTier = Math.ceil((this.percent / 100) * 8);

    // Draw active electric sparks
    for (const s of this.sparks) {
      const cx = toX(s.x1 + (s.x2 - s.x1) * s.progress);
      const cy = toY(s.y1 + (s.y2 - s.y1) * s.progress);

      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, 3 * (scale / 4)), 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw anatomical joint nodes
    const pulse = 1 + Math.sin(this.animTime * 6) * 0.15;
    for (const joint of EMBLEM_JOINTS) {
      const isLit = joint.tier <= currentTier && this.percent > 0;
      const jx = toX(joint.x);
      const jy = toY(joint.y);

      if (isLit) {
        // Ignited joint node
        ctx.shadowColor = this.themeColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = this.themeColor;
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(3, 4.5 * (scale / 4)) * pulse, 0, Math.PI * 2);
        ctx.fill();

        // White hot center
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(1.5, 2.2 * (scale / 4)), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dormant joint pin
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(1.2, 1.8 * (scale / 4)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}
