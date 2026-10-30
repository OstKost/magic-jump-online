/**
 * Progressive Web App (PWA) management module.
 * Handles install prompts, service worker registration, iOS instructions, and offline status.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function isStandaloneMode(
  win: any = typeof window !== 'undefined' ? window : undefined,
  nav: any = typeof navigator !== 'undefined' ? navigator : undefined
): boolean {
  if (!win) return false;
  const matchMediaStandalone = typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches;
  const navStandalone = nav && nav.standalone === true;
  return Boolean(matchMediaStandalone || navStandalone);
}

export function isIOSDevice(
  nav: any = typeof navigator !== 'undefined' ? navigator : undefined,
  win: any = typeof window !== 'undefined' ? window : undefined
): boolean {
  if (!nav || !nav.userAgent) return false;
  const isApple = /iPad|iPhone|iPod/.test(nav.userAgent);
  const isMSStream = win && win.MSStream;
  return Boolean(isApple && !isMSStream);
}

export function initPWA(): void {
  // 1. Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });
    });
  }

  const installButtons = document.querySelectorAll<HTMLButtonElement>('[data-install-btn]');
  const iosDialog = document.querySelector<HTMLElement>('#ios-install-dialog');
  const offlineBadge = document.querySelector<HTMLElement>('#offline-badge');
  const onlineBtn = document.querySelector<HTMLButtonElement>('#online-menu');
  const statusEl = document.querySelector<HTMLElement>('#install-device-status');

  // Platform tabs initialization for the dedicated install screen
  const tabs = document.querySelectorAll<HTMLButtonElement>('.platform-tab');
  const panes = document.querySelectorAll<HTMLElement>('.tab-pane');

  function switchTab(targetTab: string) {
    tabs.forEach((t) => {
      const active = t.dataset.tab === targetTab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    panes.forEach((p) => {
      const active = p.id === `tab-${targetTab}`;
      p.classList.toggle('active', active);
      p.hidden = !active;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target) switchTab(target);
    });
  });

  // Auto-detect matching tab for user device
  if (tabs.length) {
    if (isIOSDevice()) {
      switchTab('ios');
    } else if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      switchTab('android');
    } else {
      switchTab('desktop');
    }
  }

  function updateInstallButtons() {
    const installed = isStandaloneMode();
    installButtons.forEach((btn) => {
      if (installed) {
        btn.disabled = true;
        btn.classList.add('is-installed');
        const label = btn.querySelector('.install-text');
        if (label) label.textContent = 'Установлено ✓';
      } else {
        btn.disabled = false;
        btn.classList.remove('is-installed');
        const label = btn.querySelector('.install-text');
        if (label) label.textContent = 'Установить';
      }
    });

    if (statusEl) {
      if (installed) {
        statusEl.textContent = '✓ Игра уже установлена и работает как приложение!';
      } else if (deferredPrompt) {
        statusEl.textContent = '✓ Доступна быстрая установка в 1 клик!';
      } else if (isIOSDevice()) {
        statusEl.textContent = 'Для iPhone / iPad следуйте инструкции Safari ниже';
      } else {
        statusEl.textContent = 'Инструкция по установке для вашего браузера ниже';
      }
    }
  }

  // 2. Intercept beforeinstallprompt for Android / Chromium browsers
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    updateInstallButtons();
    console.log('[PWA] Captured beforeinstallprompt event');
  });

  // 3. React to appinstalled event
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateInstallButtons();
    showToast('Игра успешно установлена на ваше устройство!');
    console.log('[PWA] Application installed');
  });

  // 4. Install button click handler
  installButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isStandaloneMode()) {
        showToast('Игра уже установлена и запущена в автономном режиме');
        return;
      }

      if (deferredPrompt) {
        // Trigger native Chrome / Android install prompt
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[PWA] User accepted installation');
        } else {
          console.log('[PWA] User dismissed installation');
        }
        deferredPrompt = null;
        updateInstallButtons();
      } else if (isIOSDevice()) {
        // Activate iOS tab and show guidance
        switchTab('ios');
        if (iosDialog) {
          iosDialog.hidden = false;
        } else {
          showToast('В Safari нажмите кнопку «Поделиться» (⎋), затем «На экран «Домой»» (⊞)');
        }
      } else {
        // Activate desktop or android tab and show guidance
        if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
          switchTab('android');
        } else {
          switchTab('desktop');
        }
        showToast('Для установки нажмите меню браузера (⋮ или ⋯) и выберите «Установить приложение»');
      }
    });
  });

  // 5. iOS dialog close handlers
  document.querySelectorAll('.close-ios-dialog').forEach((el) => {
    el.addEventListener('click', () => {
      if (iosDialog) iosDialog.hidden = true;
    });
  });

  // 6. Online / Offline network status listener
  function updateNetworkStatus() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    updateNetworkStatusUI(isOnline, { offlineBadge, onlineBtn });
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();
  updateInstallButtons();
}

/**
 * Updates UI elements for online / offline network status.
 */
export function updateNetworkStatusUI(
  isOnline: boolean,
  elements?: {
    offlineBadge?: HTMLElement | null;
    onlineBtn?: HTMLButtonElement | null;
  }
): void {
  const badge = elements?.offlineBadge !== undefined
    ? elements.offlineBadge
    : (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('#offline-badge') : null);
  const onlineBtn = elements?.onlineBtn !== undefined
    ? elements.onlineBtn
    : (typeof document !== 'undefined' ? document.querySelector<HTMLButtonElement>('#online-menu') : null);
  const statusEl = onlineBtn?.querySelector<HTMLElement>('.menu-status');

  if (badge) {
    if (!isOnline) {
      badge.hidden = false;
      badge.textContent = 'Офлайн-режим (игра работает без интернета)';
    } else {
      badge.hidden = true;
    }
  }

  if (onlineBtn) {
    if (!isOnline) {
      onlineBtn.disabled = true;
      onlineBtn.setAttribute('aria-disabled', 'true');
      onlineBtn.title = 'Онлайн-режим недоступен без подключения к интернету';
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'нет интернета';
      }
    } else {
      onlineBtn.disabled = false;
      onlineBtn.removeAttribute('aria-disabled');
      onlineBtn.title = '';
      onlineBtn.removeAttribute('title');
      if (statusEl) {
        statusEl.hidden = true;
      }
    }
  }
}

/**
 * Lightweight in-app toast notification for PWA messages.
 */
export function showToast(message: string, duration = 3500): void {
  let toast = document.querySelector<HTMLDivElement>('#pwa-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pwa-toast';
    toast.className = 'pwa-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => {
    toast?.classList.remove('show');
  }, duration);
}
