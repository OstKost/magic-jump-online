export interface ButtonProgressOptions {
  loading: boolean;
  determinate?: boolean;
  progress?: number; // 0.0 to 1.0
  loadingText?: string;
  readyText?: string;
}

/**
 * Updates an HTML element or button with an in-button progress bar.
 * Supports determinate progress (0–100%) and indeterminate progress (shimmering runner).
 */
export function setButtonProgress(
  button: HTMLElement,
  options: ButtonProgressOptions
): void {
  if (!button) return;

  if (options.loading) {
    button.setAttribute('data-loading', 'true');
    button.classList.add('btn-progress');

    if ('disabled' in button) {
      (button as HTMLButtonElement).disabled = true;
    }

    if (options.determinate) {
      button.classList.add('btn-progress-determinate');
      button.classList.remove('btn-progress-indeterminate');

      const raw = options.progress ?? 0;
      const pct = Math.max(0, Math.min(100, Math.round(raw * 100)));
      button.style.setProperty('--btn-progress', `${pct}%`);

      button.setAttribute('role', 'progressbar');
      button.setAttribute('aria-valuenow', String(pct));
      button.setAttribute('aria-valuemin', '0');
      button.setAttribute('aria-valuemax', '100');
      button.setAttribute('aria-busy', 'true');

      if (options.loadingText !== undefined) {
        button.textContent = options.loadingText;
      }
    } else {
      button.classList.add('btn-progress-indeterminate');
      button.classList.remove('btn-progress-determinate');
      button.style.removeProperty('--btn-progress');

      button.removeAttribute('role');
      button.removeAttribute('aria-valuenow');
      button.removeAttribute('aria-valuemin');
      button.removeAttribute('aria-valuemax');
      button.setAttribute('aria-busy', 'true');

      if (options.loadingText !== undefined) {
        button.textContent = options.loadingText;
      }
    }
  } else {
    button.removeAttribute('data-loading');
    button.classList.remove(
      'btn-progress',
      'btn-progress-determinate',
      'btn-progress-indeterminate'
    );
    button.style.removeProperty('--btn-progress');

    button.removeAttribute('role');
    button.removeAttribute('aria-valuenow');
    button.removeAttribute('aria-valuemin');
    button.removeAttribute('aria-valuemax');
    button.removeAttribute('aria-busy');

    if ('disabled' in button) {
      (button as HTMLButtonElement).disabled = false;
    }

    if (options.readyText !== undefined) {
      button.textContent = options.readyText;
    }
  }
}
