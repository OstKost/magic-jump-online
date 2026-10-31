export interface FireflyColor {
  element: string;
  color: string;
  glow: string;
  spark: string;
}

export const ELEMENT_FIREFLY_PALETTES: FireflyColor[] = [
  { element: 'water', color: '#71cce8', glow: 'rgba(113, 204, 232, 0.45)', spark: '#e0f7fc' },
  { element: 'fire', color: '#efaa76', glow: 'rgba(239, 170, 118, 0.45)', spark: '#fff2df' },
  { element: 'air', color: '#a2e0da', glow: 'rgba(162, 224, 218, 0.45)', spark: '#f0fdfa' },
  { element: 'earth', color: '#a9c78c', glow: 'rgba(169, 199, 140, 0.45)', spark: '#f4fbf0' },
  { element: 'lightning', color: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)', spark: '#faf5ff' },
];

export interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  palette: FireflyColor;
  phase: number;
  pulseSpeed: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export function createFirefly(width: number, height: number, index = 0): Firefly {
  const palette = ELEMENT_FIREFLY_PALETTES[index % ELEMENT_FIREFLY_PALETTES.length];
  const angle = Math.random() * Math.PI * 2;
  const speed = 12 + Math.random() * 20;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    baseRadius: 2.2 + Math.random() * 2.2,
    palette,
    phase: Math.random() * Math.PI * 2,
    pulseSpeed: 1.5 + Math.random() * 2.5,
    trail: [],
  };
}

export function updateFirefly(firefly: Firefly, dt: number, width: number, height: number, maxTrailLength = 12): void {
  firefly.phase += dt * firefly.pulseSpeed;

  // Gentle steering with slight organic drift
  const driftAngle = Math.sin(firefly.phase * 0.7) * 0.8;
  const speed = Math.hypot(firefly.vx, firefly.vy);
  const currentAngle = Math.atan2(firefly.vy, firefly.vx) + driftAngle * dt;
  firefly.vx = Math.cos(currentAngle) * speed;
  firefly.vy = Math.sin(currentAngle) * speed;

  // Save previous point into trail
  firefly.trail.unshift({ x: firefly.x, y: firefly.y, alpha: 1 });
  if (firefly.trail.length > maxTrailLength) {
    firefly.trail.length = maxTrailLength;
  }

  // Fade trail points
  for (let i = 0; i < firefly.trail.length; i++) {
    firefly.trail[i].alpha = Math.max(0, 1 - (i + 1) / (maxTrailLength + 1));
  }

  // Move
  firefly.x += firefly.vx * dt;
  firefly.y += firefly.vy * dt;

  // Soft wrap around edges with buffer
  const pad = 24;
  if (firefly.x < -pad) firefly.x = width + pad;
  else if (firefly.x > width + pad) firefly.x = -pad;
  if (firefly.y < -pad) firefly.y = height + pad;
  else if (firefly.y > height + pad) firefly.y = -pad;
}

export class MenuFireflies {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private fireflies: Firefly[] = [];
  private animId: number | null = null;
  private lastTime = 0;
  private running = false;
  private width = 0;
  private height = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, count = 22) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'menu-fireflies';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resize();
    for (let i = 0; i < count; i++) {
      this.fireflies.push(createFirefly(this.width || 400, this.height || 600, i));
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(rect.width, 320);
    this.height = Math.max(rect.height, 420);

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  start(): void {
    if (this.running) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.renderStatic();
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.canvas.remove();
  }

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.animId = requestAnimationFrame(this.loop);
  }

  update(dt: number): void {
    for (const f of this.fireflies) {
      updateFirefly(f, dt, this.width, this.height);
    }
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const f of this.fireflies) {
      // 1. Draw light trail
      if (f.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        for (let i = 0; i < f.trail.length; i++) {
          const pt = f.trail[i];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = f.palette.glow;
        ctx.lineWidth = f.baseRadius * 0.9;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw individual fading dots along the trail
        for (let i = 0; i < f.trail.length; i++) {
          const pt = f.trail[i];
          const dotRadius = f.baseRadius * (1 - (i + 1) / (f.trail.length + 1)) * 0.75;
          if (dotRadius > 0.4) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = f.palette.color;
            ctx.globalAlpha = pt.alpha * 0.55;
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // 2. Draw glowing firefly head
      const pulse = 0.8 + 0.35 * Math.sin(f.phase);
      const outerRadius = f.baseRadius * 3.8 * pulse;

      // Soft glow aura
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, outerRadius);
      grad.addColorStop(0, f.palette.glow);
      grad.addColorStop(0.5, f.palette.glow.replace(/[\d.]+\)$/, '0.2)'));
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, outerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner core
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.baseRadius * 0.85 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = f.palette.color;
      ctx.fill();

      // Spark center
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = f.palette.spark;
      ctx.fill();
    }
  }

  private renderStatic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const f of this.fireflies) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = f.palette.color;
      ctx.fill();
    }
  }
}
