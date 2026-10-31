type Action = 'jump' | 'cast' | 'duck';

// One pictogram set for local controls and the online thumb bar.
export function actionIcon(action: Action): string {
  const paths = {
    jump: '<path d="M8 27h10m-7-4 4-8 5 3 4-8m-8 5-5-4-5 4M24 9V3m-4 4 4-4 4 4"/><circle cx="18" cy="7" r="2.5"/>',
    cast: '<path d="m6 26 14-14 4 4-14 14Zm12-12 4 4M24 3v5m-2.5-2.5h5M8 6v6m-3-3h6m16 12v5m-2.5-2.5h5"/>',
    duck: '<path d="M4 6h24M7 27h18M11 24l5-7 7 3-4 5m-3-8-6-3-5 5m9-6 5-3"/><circle cx="23" cy="12" r="2.5"/>',
  };
  return `<svg class="action-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[action]}</svg>`;
}

export function castButtonContent(key: string): string {
  return `<span class="cast-glyph">${actionIcon('cast')}</span><strong>Магия</strong><small>Готово</small><kbd>${key}</kbd>`;
}
