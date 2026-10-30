import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStandaloneMode, isIOSDevice, updateNetworkStatusUI } from './pwa.ts';

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

test('updateNetworkStatusUI disables online menu and marks it when offline', () => {
  const badge = { hidden: true, textContent: '' } as any;
  const statusEl = { hidden: true, textContent: '' } as any;
  const onlineBtn = {
    disabled: false,
    title: '',
    attrs: {} as Record<string, string>,
    setAttribute(name: string, val: string) {
      this.attrs[name] = val;
    },
    removeAttribute(name: string) {
      delete this.attrs[name];
    },
    getAttribute(name: string) {
      return this.attrs[name] ?? null;
    },
    querySelector(selector: string) {
      if (selector === '.menu-status') return statusEl;
      return null;
    },
  } as any;

  // 1. Goes offline
  updateNetworkStatusUI(false, { offlineBadge: badge, onlineBtn });

  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /Офлайн-режим/);
  assert.equal(onlineBtn.disabled, true);
  assert.equal(onlineBtn.getAttribute('aria-disabled'), 'true');
  assert.match(onlineBtn.title, /недоступен/i);
  assert.equal(statusEl.hidden, false);
  assert.equal(statusEl.textContent, 'нет интернета');

  // 2. Returns online
  updateNetworkStatusUI(true, { offlineBadge: badge, onlineBtn });

  assert.equal(badge.hidden, true);
  assert.equal(onlineBtn.disabled, false);
  assert.equal(onlineBtn.getAttribute('aria-disabled'), null);
  assert.equal(onlineBtn.title, '');
  assert.equal(statusEl.hidden, true);

  // 3. Gracefully handles undefined or null elements without throwing
  assert.doesNotThrow(() => {
    updateNetworkStatusUI(false, { offlineBadge: null, onlineBtn: null });
    updateNetworkStatusUI(true, { offlineBadge: null, onlineBtn: null });
  });
});
