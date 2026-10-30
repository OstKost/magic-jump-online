/** Keyboard navigation shared by static menus and dynamically rendered screens. */
export function installMenuKeyboard(root: HTMLElement) {
  const visible = (element: HTMLElement) => element.getClientRects().length > 0 &&
    !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden';

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && (active.isContentEditable || active.closest('input, textarea, select'))) return;

    const modal = Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(visible).at(-1);
    const screen = root.querySelector<HTMLElement>('.screen:not([hidden])');
    if (!modal && (!screen || screen.id === 'play-screen' || screen.id === 'splash')) return;
    if (!modal && screen?.id === 'online' && root.querySelector<HTMLElement>('#online-match:not([hidden])')) return;
    const scope = modal ?? screen!;
    const items = Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')).filter(visible);
    if (!items.length) return;

    const direction = ({ ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1,
      KeyW: -1, KeyA: -1, KeyS: 1, KeyD: 1 } as Record<string, number>)[event.code];
    const confirm = event.code === 'Space' || event.code === 'Enter';
    if (!direction && !confirm) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const index = items.indexOf(active as HTMLElement);
    if (direction) {
      const next = index < 0 ? (direction > 0 ? 0 : items.length - 1) : (index + direction + items.length) % items.length;
      items[next].focus();
    } else if (!event.repeat) {
      const item = items[index < 0 ? 0 : index];
      item.focus();
      item.click();
    }
  }, { capture: true });
}
