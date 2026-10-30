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
        if (label) label.textContent = 'Скачать игру';
      }
    });
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
        // Show iOS Safari tutorial modal
        if (iosDialog) {
          iosDialog.hidden = false;
        }
      } else {
        // Helpful fallback instructions for browsers where prompt has not yet fired
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
    if (!offlineBadge) return;
    if (!navigator.onLine) {
      offlineBadge.hidden = false;
      offlineBadge.textContent = 'Офлайн-режим (игра работает без интернета)';
    } else {
      offlineBadge.hidden = true;
    }
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();
  updateInstallButtons();
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
