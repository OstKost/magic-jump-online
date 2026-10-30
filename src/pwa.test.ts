import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStandaloneMode, isIOSDevice } from './pwa.ts';

test('isStandaloneMode detects display-mode standalone and navigator.standalone', () => {
  // 1. Browser mode (not standalone)
  const browserWindow = {
    matchMedia: (query: string) => ({
      matches: false,
    }),
  };
  const browserNav = { standalone: false, userAgent: 'Mozilla/5.0' };
  assert.equal(isStandaloneMode(browserWindow, browserNav), false);

  // 2. Standalone via matchMedia (Android / Chrome PWA)
  const pwaWindow = {
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)',
    }),
  };
  assert.equal(isStandaloneMode(pwaWindow, { standalone: false }), true);

  // 3. Standalone via navigator.standalone (iOS Safari PWA)
  const iosPwaNav = { standalone: true, userAgent: 'iPhone' };
  assert.equal(isStandaloneMode(browserWindow, iosPwaNav), true);

  // 4. Undefined window
  assert.equal(isStandaloneMode(undefined, undefined), false);
});

test('isIOSDevice correctly identifies iPad, iPhone, and iPod in user agent', () => {
  // iPhone
  assert.equal(
    isIOSDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }, {}),
    true
  );

  // iPad
  assert.equal(
    isIOSDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }, {}),
    true
  );

  // iPod
  assert.equal(
    isIOSDevice({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)' }, {}),
    true
  );

  // Android
  assert.equal(
    isIOSDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' }, {}),
    false
  );

  // Desktop Chrome
  assert.equal(
    isIOSDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, {}),
    false
  );

  // Null/undefined checks
  assert.equal(isIOSDevice(undefined, undefined), false);
  assert.equal(isIOSDevice({ userAgent: '' }, undefined), false);
});
