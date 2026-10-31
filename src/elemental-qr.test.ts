import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGameShareUrl,
  generateElementalQRMatrix,
  isFinderModule,
  splashShareMarkup,
  mountSplashShareWidget,
} from './elemental-qr.ts';

describe('elemental-qr module', () => {
  it('getGameShareUrl strips search queries and hashes', () => {
    const urlWithParams = 'https://game.jumping-girls.online/play?room=MAGIC123&player=sofia#lobby';
    const clean = getGameShareUrl(urlWithParams);
    assert.equal(clean, 'https://game.jumping-girls.online/play');

    const cleanOrigin = getGameShareUrl('http://localhost:5173/?room=XYZ');
    assert.equal(cleanOrigin, 'http://localhost:5173/');

    // Fallback on invalid url
    assert.equal(getGameShareUrl('not-a-valid-url'), 'http://localhost:5173/');
  });

  it('generateElementalQRMatrix creates a matrix with elemental finder tags', () => {
    const matrix = generateElementalQRMatrix('https://example.com/play', 2, 'H');
    assert.ok(matrix.size >= 21, `Expected QR size >= 21, got ${matrix.size}`);
    assert.equal(matrix.margin, 2);
    assert.equal(matrix.totalModules, matrix.size + 4);
    assert.equal(matrix.modules.length, matrix.size);
    assert.equal(matrix.modules[0].length, matrix.size);

    // Finder corners should be correctly located
    assert.deepEqual(matrix.finders.water, { startRow: 0, startCol: 0 });
    assert.deepEqual(matrix.finders.fire, { startRow: 0, startCol: matrix.size - 7 });
    assert.deepEqual(matrix.finders.earth, { startRow: matrix.size - 7, startCol: 0 });
  });

  it('isFinderModule accurately detects elemental corner positions', () => {
    const size = 29;

    // Water: top-left (0..6, 0..6)
    assert.equal(isFinderModule(0, 0, size), 'water');
    assert.equal(isFinderModule(6, 6, size), 'water');
    assert.equal(isFinderModule(3, 3, size), 'water');

    // Fire: top-right (0..6, 22..28)
    assert.equal(isFinderModule(0, 22, size), 'fire');
    assert.equal(isFinderModule(6, 28, size), 'fire');

    // Earth: bottom-left (22..28, 0..6)
    assert.equal(isFinderModule(22, 0, size), 'earth');
    assert.equal(isFinderModule(28, 6, size), 'earth');

    // Data / non-finder modules
    assert.equal(isFinderModule(7, 7, size), undefined);
    assert.equal(isFinderModule(14, 14, size), undefined);
    assert.equal(isFinderModule(28, 28, size), undefined); // Bottom-right is not a finder
  });

  it('splashShareMarkup produces accessible markup with required elements', () => {
    const html = splashShareMarkup();
    assert.ok(html.includes('id="splash-share"'), 'Must have #splash-share id');
    assert.ok(html.includes('id="splash-qr"'), 'Must have #splash-qr canvas');
    assert.ok(html.includes('id="splash-copy-btn"'), 'Must have #splash-copy-btn button');
    assert.ok(html.includes('МАГИЯ СТИХИЙ'), 'Must have elemental theme label');
    assert.ok(html.includes('水') && html.includes('火') && html.includes('土') && html.includes('風'), 'Must include 4 elemental runes');
  });

  it('mountSplashShareWidget stops event propagation and wires copy handler', async () => {
    // Create mock DOM structure
    const container = {
      innerHTML: splashShareMarkup(),
      querySelector(selector: string) {
        if (selector === '#splash-share') return shareCard;
        if (selector === '#splash-copy-btn') return copyBtn;
        if (selector === '#splash-qr') return qrCanvas;
        if (selector === '.elemental-qr-plate') return plate;
        return null;
      },
    };

    let pointerDownStopped = false;
    let toastMessage = '';

    const shareCard = {
      addEventListener(event: string, handler: (e: any) => void) {
        if (event === 'pointerdown') {
          handler({
            stopPropagation() {
              pointerDownStopped = true;
            },
          });
        }
      },
      removeEventListener() {},
    };

    const copyBtn = {
      classList: {
        add(cls: string) {},
        remove(cls: string) {},
      },
      querySelector(sel: string) {
        return { textContent: '' };
      },
      addEventListener(event: string, handler: (e: any) => void) {},
      removeEventListener() {},
    };

    const qrCanvas = {
      clientWidth: 126,
      width: 0,
      height: 0,
      style: {},
      getContext() {
        return null; // fallback in node
      },
    };

    const plate = {
      style: {},
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
    };

    const unmount = mountSplashShareWidget(container as any, {
      getUrl: () => 'https://example.com/magic',
      onToast: (msg) => {
        toastMessage = msg;
      },
    });

    assert.equal(pointerDownStopped, true, 'Pointerdown on share card must stop propagation');
    assert.equal(typeof unmount, 'function', 'Must return unmount cleanup function');
    unmount();
  });
});
