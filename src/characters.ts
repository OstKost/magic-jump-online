export const CHARACTERS = [
  { key: 'sofia', name: 'София', element: 'Вода', symbol: '水', color: '#71cce8', pet: 'black-cat', petRest: 'black-cat-rest', petName: 'Черныш', petType: 'Кот', companionReadyText: 'Ваш кот Черныш уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: true, run: 8, idle: 1, duck: 3, scale: .72 },
  { key: 'stella', name: 'Стелла', element: 'Огонь', symbol: '火', color: '#efaa76', pet: 'ginger-cat', petRest: 'ginger-cat-rest', petName: 'Рыжик', petType: 'Кот', companionReadyText: 'Ваш кот Рыжик уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: true, run: 8, idle: 1, duck: 3, scale: .72 },
  { key: 'air', name: 'Янг', element: 'Воздух', symbol: '風', color: '#a2e0da', pet: 'eagle', petRest: 'eagle-rest', petName: 'Орёл', petType: 'Орёл', companionReadyText: 'Ваш орёл уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 3, duck: 2, scale: .9 },
  { key: 'earth', name: 'Болдер', element: 'Земля', symbol: '土', color: '#a9c78c', pet: 'fox', petRest: 'fox-rest', petName: 'Лиса', petType: 'Лиса', companionReadyText: 'Ваша лиса уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 3, duck: 2, scale: .9 },
] as const;
export type Character = typeof CHARACTERS[number];
export function portraitMarkup(hero: Character) {
  return `<span class="hero-portrait ${hero.spritePortrait ? 'sprite-portrait' : ''}" style="--hero-color:${hero.color}"><img src="/assets/characters/${hero.key}/${hero.portrait}" alt="${hero.name}" draggable="false"></span>`;
}
export function petMarkup(hero: Character) {
  const label = hero.petType === hero.petName ? `${hero.petName}` : `${hero.petType} ${hero.petName}`;
  const restKey = hero.petRest;
  return `<span class="companion" style="--pet-image:url('/assets/pets/${restKey}.png')" role="img" aria-label="${label} — спутник персонажа ${hero.name}"></span>`;
}
