import QRCode from 'qrcode';

export interface ElementalQROptions {
  width?: number;
  margin?: number;
  centerBadge?: 'elements' | 'room' | 'spark' | 'none';
}

export type FinderElement = 'water' | 'fire' | 'earth';

export interface ModuleInfo {
  row: number;
  col: number;
  finder?: FinderElement;
  inCenter: boolean;
}

export interface ElementalQRMatrix {
  size: number;
  margin: number;
  totalModules: number;
  modules: boolean[][];
  finders: {
    water: { startRow: number; startCol: number };
    fire: { startRow: number; startCol: number };
    earth: { startRow: number; startCol: number };
  };
}

/**
 * Returns a clean, shareable URL for the game by stripping room codes, hashes, and query params.
 */
export function getGameShareUrl(inputUrl?: string): string {
  try {
    const raw = inputUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173');
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return 'http://localhost:5173/';
  }
}

/**
 * Generates the QR matrix with high error correction and identifies elemental finders.
 */
export function generateElementalQRMatrix(
  text: string,
  margin = 2,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'H'
): ElementalQRMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const size = qr.modules.size;
  const modules: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Boolean(qr.modules.get(r, c)));
    }
    modules.push(row);
  }

  return {
    size,
    margin,
    totalModules: size + margin * 2,
    modules,
    finders: {
      water: { startRow: 0, startCol: 0 },
      fire: { startRow: 0, startCol: size - 7 },
      earth: { startRow: size - 7, startCol: 0 },
    },
  };
}

export function isFinderModule(row: number, col: number, size: number): FinderElement | undefined {
  if (row < 7 && col < 7) return 'water';
  if (row < 7 && col >= size - 7) return 'fire';
  if (row >= size - 7 && col < 7) return 'earth';
  return undefined;
}

/**
 * Draws the elemental QR code onto a 2D canvas context.
 */
export function drawElementalQR(
  ctx: CanvasRenderingContext2D,
  matrix: ElementalQRMatrix,
  displaySize: number,
  options: ElementalQROptions = {}
): void {
  const { size, margin, totalModules, modules } = matrix;
  const cellSize = displaySize / totalModules;
  const centerBadge = options.centerBadge ?? 'elements';

  // 1. Bright pearl background for 100% universal camera contrast
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, displaySize, displaySize);

  // Soft elemental corner tints in the background margin
  const gradMargin = ctx.createRadialGradient(
    displaySize * 0.5,
    displaySize * 0.5,
    displaySize * 0.2,
    displaySize * 0.5,
    displaySize * 0.5,
    displaySize * 0.75
  );
  gradMargin.addColorStop(0, '#ffffff');
  gradMargin.addColorStop(1, '#f7fafc');
  ctx.fillStyle = gradMargin;
  ctx.fillRect(0, 0, displaySize, displaySize);

  const cx = displaySize / 2;
  const cy = displaySize / 2;
  const medallionRadius = cellSize * 2.5;

  // 2. Linear elemental gradient for data modules:
  // Water (#0284c7) -> Air (#0d9488) -> Fire (#ea580c) -> Lightning (#7c3aed) -> Earth (#15803d)
  const dataGrad = ctx.createLinearGradient(
    margin * cellSize,
    margin * cellSize,
    (size + margin) * cellSize,
    (size + margin) * cellSize
  );
  dataGrad.addColorStop(0, '#0284c7');
  dataGrad.addColorStop(0.3, '#0d9488');
  dataGrad.addColorStop(0.65, '#ea580c');
  dataGrad.addColorStop(0.85, '#7c3aed');
  dataGrad.addColorStop(1, '#15803d');

  // Colors for dedicated elemental finder eyes
  const finderColors = {
    water: '#0284c7', // Water sapphire (Sofia)
    fire: '#c2410c', // Fire ruby flame (Stella)
    earth: '#15803d', // Earth jade forest (Boulder)
  };

  // 3. Render modules
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;

      const x = (c + margin) * cellSize;
      const y = (r + margin) * cellSize;

      // Check if this module collides with the center medallion
      if (centerBadge !== 'none') {
        const midX = x + cellSize / 2;
        const midY = y + cellSize / 2;
        const dist = Math.hypot(midX - cx, midY - cy);
        if (dist < medallionRadius + 1.2) {
          continue;
        }
      }

      const finder = isFinderModule(r, c, size);
      if (finder) {
        ctx.fillStyle = finderColors[finder];
      } else {
        ctx.fillStyle = dataGrad;
      }

      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }

  // 4. Center Elemental Medallion / Talisman
  if (centerBadge !== 'none') {
    ctx.save();

    // Outer white halo disc
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, medallionRadius + 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark night disc
    ctx.fillStyle = '#102330';
    ctx.beginPath();
    ctx.arc(cx, cy, medallionRadius, 0, Math.PI * 2);
    ctx.fill();

    // Dual elemental rings: Water cyan arc (top/left) and Fire amber arc (bottom/right)
    ctx.lineWidth = Math.max(1.5, cellSize * 0.35);

    // Water arc
    ctx.strokeStyle = '#71cce8';
    ctx.beginPath();
    ctx.arc(cx, cy, medallionRadius - 1, Math.PI * 0.75, Math.PI * 1.75);
    ctx.stroke();

    // Fire arc
    ctx.strokeStyle = '#efaa76';
    ctx.beginPath();
    ctx.arc(cx, cy, medallionRadius - 1, Math.PI * 1.75, Math.PI * 2.75);
    ctx.stroke();

    if (centerBadge === 'room') {
      // Room emblem: glowing golden crystal / key star
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      const pr = medallionRadius * 0.45;
      ctx.arc(cx, cy, pr, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = '#102330';
      ctx.beginPath();
      ctx.arc(cx, cy, pr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dual Sofia & Stella elemental sparks (Water cyan & Fire amber)
      const pr = medallionRadius * 0.32;
      const offset = medallionRadius * 0.38;

      // Water spark
      ctx.fillStyle = '#71cce8';
      ctx.beginPath();
      ctx.arc(cx - offset, cy, pr, 0, Math.PI * 2);
      ctx.fill();

      // Fire spark
      ctx.fillStyle = '#efaa76';
      ctx.beginPath();
      ctx.arc(cx + offset, cy, pr, 0, Math.PI * 2);
      ctx.fill();

      // Central unifying magic spark
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, pr * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * Renders an elemental styled QR code onto a canvas element.
 */
export async function renderElementalQR(
  canvas: HTMLCanvasElement,
  text: string,
  options: ElementalQROptions = {}
): Promise<void> {
  const displaySize = options.width ?? (canvas.clientWidth > 0 ? canvas.clientWidth : 136);
  const margin = options.margin ?? 2;
  const dpr = Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  canvas.width = Math.round(displaySize * dpr);
  canvas.height = Math.round(displaySize * dpr);
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  const matrix = generateElementalQRMatrix(text, margin, 'H');
  drawElementalQR(ctx, matrix, displaySize, options);

  ctx.restore();
}

/**
 * HTML markup for the splash screen Elemental QR Share card.
 */
export function splashShareMarkup(): string {
  return `
<div class="splash-share" id="splash-share" role="region" aria-label="Поделиться игрой">
  <div class="elemental-qr-card">
    <div class="elemental-runes-bar" aria-hidden="true">
      <span class="rune-pill rune-water" title="Вода">水 💧</span>
      <span class="rune-pill rune-fire" title="Огонь">火 🔥</span>
      <span class="rune-pill rune-earth" title="Земля">土 🍃</span>
      <span class="rune-pill rune-air" title="Воздух">風 ⚡</span>
    </div>
    <div class="elemental-qr-header">
      <span class="elemental-qr-eyebrow">МАГИЯ СТИХИЙ</span>
      <strong class="elemental-qr-title">Поделиться игрой</strong>
      <p class="elemental-qr-subtitle">Наведи камеру смартфона</p>
    </div>
    <div class="elemental-qr-plate">
      <canvas id="splash-qr" class="elemental-qr-canvas" aria-label="QR-код для игры"></canvas>
    </div>
    <div class="elemental-qr-actions">
      <button type="button" id="splash-copy-btn" class="elemental-qr-btn" aria-label="Скопировать ссылку на игру">
        <span class="btn-glyph" aria-hidden="true">🔗</span>
        <span class="btn-label">Скопировать ссылку</span>
      </button>
    </div>
  </div>
</div>
`.trim();
}

/**
 * Mounts interactive handlers for the splash share widget.
 */
export function mountSplashShareWidget(
  container: HTMLElement,
  options: {
    onToast?: (msg: string) => void;
    getUrl?: () => string;
  } = {}
): () => void {
  const shareCard = container.querySelector<HTMLElement>('#splash-share');
  const copyBtn = container.querySelector<HTMLButtonElement>('#splash-copy-btn');
  const qrCanvas = container.querySelector<HTMLCanvasElement>('#splash-qr');

  if (!shareCard || !copyBtn || !qrCanvas) {
    return () => {};
  }

  const getUrl = options.getUrl ?? (() => getGameShareUrl());
  const showToast = options.onToast ?? (() => {});

  // Prevent clicks or touches inside the share widget from triggering splash screen dismissal
  const stopEvent = (e: Event) => {
    e.stopPropagation();
  };

  shareCard.addEventListener('pointerdown', stopEvent);
  shareCard.addEventListener('click', stopEvent);
  shareCard.addEventListener('touchstart', stopEvent);

  // Render the elemental QR
  const shareUrl = getUrl();
  const renderCurrent = () => {
    const targetWidth = qrCanvas.clientWidth > 0 ? qrCanvas.clientWidth : 126;
    void renderElementalQR(qrCanvas, shareUrl, {
      width: targetWidth,
      centerBadge: 'elements',
    }).catch(() => {});
  };

  renderCurrent();

  let resizeTimer: number | undefined;
  const onResize = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderCurrent, 150);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
  }

  let resetTimer: number | undefined;

  const handleShareOrCopy = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    const url = getUrl();
    let copied = false;

    // Try native Web Share API on mobile if supported
    if (typeof navigator !== 'undefined' && 'share' in navigator && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: 'Волшебный Прыжок Онлайн',
          text: 'Сыграем вместе в Волшебный Прыжок Онлайн! Маги стихий ждут тебя:',
          url,
        });
        showToast('Ссылка отправлена! ✨');
        return;
      } catch {
        // Fall back to clipboard if user dismissed or share failed
      }
    }

    // Clipboard copy
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      showToast('✨ Ссылка на игру скопирована!');
      copyBtn.classList.add('is-copied');
      const label = copyBtn.querySelector('.btn-label');
      const glyph = copyBtn.querySelector('.btn-glyph');
      if (label) label.textContent = 'Скопировано! ✓';
      if (glyph) glyph.textContent = '✓';

      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        if (label) label.textContent = 'Скопировать ссылку';
        if (glyph) glyph.textContent = '🔗';
      }, 2000);
    } else {
      showToast('Не удалось скопировать ссылку');
    }
  };

  copyBtn.addEventListener('click', handleShareOrCopy);

  // Clicking on the canvas plate also copies/shares
  const plate = container.querySelector<HTMLElement>('.elemental-qr-plate');
  if (plate) {
    plate.style.cursor = 'pointer';
    plate.setAttribute('title', 'Нажмите, чтобы скопировать ссылку');
    plate.addEventListener('click', handleShareOrCopy);
  }

  return () => {
    shareCard.removeEventListener('pointerdown', stopEvent);
    shareCard.removeEventListener('click', stopEvent);
    shareCard.removeEventListener('touchstart', stopEvent);
    copyBtn.removeEventListener('click', handleShareOrCopy);
    if (plate) plate.removeEventListener('click', handleShareOrCopy);
    if (resetTimer) window.clearTimeout(resetTimer);
    if (resizeTimer) window.clearTimeout(resizeTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
    }
  };
}
