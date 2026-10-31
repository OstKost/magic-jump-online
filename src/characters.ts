export const CHARACTERS = [
  { key: 'sofia', name: 'София', element: 'Вода', symbol: '水', color: '#71cce8', pet: 'black-cat', petRest: 'black-cat-rest', petName: 'Черныш', petType: 'Кот', companionReadyText: 'Ваш кот Черныш уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: true, run: 8, idle: 1, duck: 3, scale: .72 },
  { key: 'stella', name: 'Стелла', element: 'Огонь', symbol: '火', color: '#efaa76', pet: 'stella-cat', petRest: 'stella-cat-rest', petName: 'Рыжик', petType: 'Кот', companionReadyText: 'Ваш кот Рыжик уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 8, idle: 4, duck: 7, scale: .95 },
  { key: 'air', name: 'Янг', element: 'Воздух', symbol: '風', color: '#a2e0da', pet: 'eagle', petRest: 'eagle-rest', petName: 'Орёл', petType: 'Орёл', companionReadyText: 'Ваш орёл уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 3, duck: 2, scale: .9 },
  { key: 'earth', name: 'Болдер', element: 'Земля', symbol: '土', color: '#a9c78c', pet: 'fox', petRest: 'fox-rest', petName: 'Лиса', petType: 'Лиса', companionReadyText: 'Ваша лиса уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 3, duck: 2, scale: .9 },
  { key: 'kai', name: 'Кай', element: 'Молния', symbol: '⚡', color: '#a855f7', pet: 'falcon', petRest: 'falcon-rest', petName: 'Сокол', petType: 'Сокол', companionReadyText: 'Ваш сокол уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 3, duck: 3, scale: .9 },
  { key: 'leya', name: 'Лея', element: 'Природа', symbol: '🌿', color: '#22c55e', pet: 'red-panda', petRest: 'red-panda-rest', petName: 'Панда', petType: 'Панда', companionReadyText: 'Ваша панда уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 6, idle: 4, duck: 3, scale: .9 },
  { key: 'sensei', name: 'Сенсей', element: 'Четыре стихии', symbol: '◉', color: '#d5be80', pet: 'sensei-dog', petRest: 'sensei-dog-rest', petName: 'Хатико', petType: 'Сиба-ину', companionReadyText: 'Ваш верный Хатико уже рядом.', portrait: 'avatar.png', spritePortrait: false, clean: false, run: 8, idle: 4, duck: 3, scale: .95 },
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

export function availableCharacters(unlocked: boolean) {
  return CHARACTERS.map((hero, index) => ({ hero, index })).filter(({ index }) => unlocked || index < 4 || index === 6);
}
