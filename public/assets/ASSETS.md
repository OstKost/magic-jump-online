# Игровая графика — София и Стелла

Все пути ниже относительно `public/assets/`; браузерные пути начинаются с `/assets/`.

## Активные персонажи и анимации

Игра использует **`characters/sofia/atlas-elemental.png` + `atlas-elemental.json`** и **`characters/stella/atlas-elemental.png` + `atlas-elemental.json`**.

Это новые прозрачные листы, созданные встроенным image_gen по исходным атласам: сохранены внешность, причёски, костюмы и рисованный стиль. Убраны брызги, пламя, облачка и отдельные обломки эффектов. Для бега созданы восемь фаз с чередованием опорной ноги. Исходники генерации и точные запросы: `characters/generated/` и `characters/generated/PROMPT.md`.

- София — водная героиня с косой, сине-белый костюм; `characters/sofia/`.
- Стелла — огненная героиня с длинными волосами, красно-чёрный костюм; `characters/stella/`.

У обеих одинаковые ключи кадров в атласе:

- `run-00` … `run-07` — восемь фаз бега; цикл 12 кадров/с в первом мире. Темп растёт пропорционально скорости мира.
- `jump-00`, `jump-01`, `jump-02` — отталкивание, верхняя точка, приземление; выбор по вертикальной скорости.
- `idle-00` — ожидание.
- `duck-00`, `duck-01`, `duck-02` — присед и две фазы низкого подката; 8 кадров/с однократно, затем удержание последней позы.
- `hit-00`, `hit-01` — короткая начальная сгруппированная поза и лежащая героиня. Начальная поза использует рисунок `jump-00`, отдельной генерации отдачи не было.

Отдельные PNG имеют суффикс `-clean.png`, например `run-07-clean.png`. Всего 17 кадров на героиню. Каждый — RGBA PNG 256 × 256; точка опоры `(128,240)`, то есть `setOrigin(0.5, 240/256)`. Масштаб рисунка един для всех поз одной героини, нормирован по высоте стоящей позы 140 px. Коллайдер рассчитывается отдельно от изображения.

Атлас — 2112 × 792, восемь столбцов и три строки с ячейкой 264 × 264. Кадр 256 × 256 расположен с отступом 4 px от края ячейки: прозрачные промежутки защищают от подмешивания соседних кадров при фильтрации. Координаты берутся из JSON Hash, делить атлас вручную на 256 не нужно.

```ts
this.load.atlas('sofia', 'assets/characters/sofia/atlas-elemental.png', 'assets/characters/sofia/atlas-elemental.json');
this.add.sprite(160, floor, 'sofia', 'idle-00').setOrigin(0.5, 240 / 256);
```

Обзор новых кадров: `characters/animation-preview-clean.jpg`. Анимированный предпросмотр бега: `characters/run-cycle-clean.gif`. Машиночитаемая карта: `characters/animations-clean.json`. Повторная сборка из сохранённых листов: `python scripts/prepare_clean_animations.py` (Pillow, NumPy). Скрипт ищет пустые промежутки между рисунками, чтобы не отрезать выступающие сапоги и волосы. Повторная генерация для сборки не требуется.

## Магия стихий

Основная вода и огонь **встроены в PNG-кадры прыжка и приседа**. Магия касается рук, ног и костюма, а её форма меняется вместе с позой. Активные атласы `atlas-elemental.png/json` содержат шесть новых кадров действий и прежние чистые кадры бега, ожидания и падения. Отдельные новые PNG: `jump-00-elemental.png` … `jump-02-elemental.png` и `duck-00-elemental.png` … `duck-02-elemental.png` в папке каждой героини. Геометрия ячеек и имена кадров в JSON сохранены.

Исходники правки image_gen: `characters/generated/sofia-actions-magic.png` и `stella-actions-magic.png`; точные запросы — `characters/generated/PROMPT-ELEMENTAL.md`. Обзор — `characters/action-preview-elemental.jpg`. Сборка: `python scripts/prepare_elemental_animations.py` (Pillow); она берёт восемь фаз бега из clean-файлов без изменений и заменяет только шесть кадров действий. Чистые атласы сохранены как предыдущая версия.

`src/element-magic.ts` добавляет только микроэффекты: редкие точки размером 0.45–1 логический пиксель с прозрачностью до 28% и короткую водяную рябь с прозрачностью до 16%. Максимум восемь частиц на героиню, время жизни 0.18–0.34 с, небольшое смещение рядом с ногами. Крупных отдельных лент и огненных треугольников больше нет. На паузе микроэффекты замирают, в конце раунда очищаются. На столкновения они не влияют.

## Управление приседом

Удерживать S у Софии или ↓ у Стеллы либо отдельную экранную кнопку. Присед уменьшает высоту области столкновения и позволяет пройти под верхним бревном с меткой «↓ ПРИСЕД», но не защищает от наземных препятствий. В воздухе присед не активен; если кнопка удерживается, включится после приземления. Пауза и потеря фокуса сбрасывают удержание.

## Препятствия

### Наземные препятствия (прыжок)
Нарезаны из `pics/sprite.png`. Прозрачные PNG 256 × 192, точка опоры `(128,176)`, то есть `setOrigin(0.5, 176/192)`.

- `obstacles/rock.png` — группа скал, перепрыгивание.
- `obstacles/stakes.png` — частокол, перепрыгивание.
- `obstacles/log.png` — бревно с камнями; на земле перепрыгивание.
- `obstacles/lantern.png` — каменный фонарь, резерв для декораций.
- `obstacles/banner.png` — знамя водного пути, резерв для декораций.

### Нависающие препятствия (присед / подкат `overhead`)
Расположены в `public/assets/obstacles/overhead/`. Прозрачные PNG 200 × 160, точка опоры `(100, 155)`, то есть `setOrigin(0.5, 155/160)`. Опасная зона коллизии — от 76 до 112 px над землёй, а висящие опасности (фонари, сладости, сканеры, птицы на ветках, воздушные змеи на колышках, перекладины ворот) приподняты выше с комфортным клиренсом до 83 px (персонаж в приседе высотой 66 px проходит с безопасным запасом 17 px; стоящий персонаж высотой 102 px задевает препятствие точно по центру лба).

Все препятствия имеют физическую опору на земле:
- **Мир 1: «Горы небожителей»**
  - `level-0-variant-0.png` — цветущая сакура со стволом и нависающей ветвью со священным фонарём (уклоняемся от фонаря);
  - `level-0-variant-1.png` — древняя искривлённая сосна с сидящим на нижней ветви белым журавлём;
  - `level-0-variant-2.png` — парящий драконий воздушный змей на натянутой верёвке от колышка в земле;
  - `level-0-variant-3.png` — традиционные алые ворота Тории с перекладиной (проскакиваем под ними).
- **Мир 2: «Конфетный мир»**
  - `level-1-variant-0.png` — конфетное дерево с шоколадным стволом и висящим на ветке леденцом/трюфелем;
  - `level-1-variant-1.png` — пряничное дерево с глазурью и сидящей на ветке пухлой зефирной пчелой;
  - `level-1-variant-2.png` — леденцовый воздушный змей на нитке от карамельного колышка в земле;
  - `level-1-variant-3.png` — карамельные ворота Candy Cane Torii из полосатых тростей с вафельной перекладиной.
- **Мир 3: «Млечный путь»**
  - `level-2-variant-0.png` — космический кристаллический пилон со свисающим неоновым сканером;
  - `level-2-variant-1.png` — металлическая вышка связи с горизонтальной балкой и сидящим дроном;
  - `level-2-variant-2.png` — парящий метеозонд на энерго-тросе от посадочного маяка в земле;
  - `level-2-variant-3.png` — квантовые портальные ворота с двумя пилонами и плазменной аркой.

Сводный предпросмотр: `obstacles/overhead-preview.png`. Генерация и сборка: `python scripts/prepare_overhead_obstacles.py`.

## Движение мира

Активные панорамы: `../art/level-1-bg.png` («Горы небожителей»), `../art/level-2-bg.png` («Конфетный мир»), `../art/level-3-bg.png` («Млечный путь»). Исходные изображения 2048 × 683 предоставлены пользователем, без дополнительной генерации.

`src/backgrounds.ts` выделяет пол из нижней части изображений: поверхность на y = 550 / 540 / 575. Она совпадает с линией опоры персонажей (92% высоты дорожки). Фон движется влево очень медленно, 3 px/с; пол — со скоростью препятствий, 270 / 310 / 350 px/с. Для непрерывной прокрутки за панорамой следует зеркальная копия. На паузе и после конца раунда прокрутка останавливается.

`backgrounds/jade-valley.png` — ранее сгенерированный фон горной долины, 1536 × 1024; оставлен в библиотеке, в текущей игре не используется. Запрос сохранён в `backgrounds/PROMPT.md`. Это цельная иллюстрация, бесшовность для скролла не гарантируется.

## Сохранённая первая нарезка

`pics/sprite.png` (1774 × 887) и прежние файлы сохранены: `characters/sofia/atlas.png`, `characters/stella/atlas.png`, их JSON и PNG без суффикса `-clean`, `sprites.json`, `sprite-preview.jpg`. Они **не используются текущими анимациями**. На них остаются ограничения исходного концепт-листа: соединённые шлейфы и близкие по положению ног фазы бега.

Скрипт `scripts/prepare_sprites.py` воспроизводит старую нарезку и препятствия (Pillow, NumPy, SciPy); новые clean-атласы он не перезаписывает. Игроки 3 и 4 описаны отдельно в `ASSETS-3-4.md`.

## Обновление оформления

Шлейфы действий в `element-magic.ts` рисуются по истории положения ног за 0.5 секунды: широкая полупрозрачная лента и светлая сердцевина. При завершении очищаются вместе с частицами. Стрелки первого уровня увеличены втрое. Горная перекладина получила изогнутую храмовую крышу; цвета остальных арок соответствуют конфетному и космическому мирам. Нижняя полоса первого фона выделяется с y=570.

## Враги и заклинания

`enemies/{ninja,archer,gingerbread,slime,robot,alien}.png`: прозрачные листы 768 × 192, четыре кадра 192 × 192, опора `(96,192)`, масштаб в игре `.46`. Анимация 6 кадров/с; падение — поворот с исчезновением за 400 мс. Исходник и запрос: `enemies/generated/`. Сборка: `python3 scripts/prepare_enemies.py` (Pillow).

Заклинания рисуются в `src/combat-art.ts`, одинаково в Phaser и сетевом Canvas. Управление: D / → и экранная кнопка. Перезарядка 2 с, дальность 650 px, скорость 700 px/с. Враг заменяет половину наземных блоков без сопутствующего бонуса; награда за поражение 25 очков, обход без награды.

В добавленных мирах используются те же наборы: «Топь» — лесной лучник и болотный слизень; «Дюна» — песчаный ниндзя и робот-страж. Таблица соответствий находится в `src/combat.ts`.

## Топь и Дюна

Миры 4 и 5: `../art/level-4-bg.png` и `level-5-bg.png`, панорамы 2048 × 683. Источники и запросы сохранены в `pics/new-worlds/`; сборка — `scripts/prepare_new_worlds.py`.
Наземные препятствия `obstacles/world-{3,4}-{0,1,2}.png` используют прежние размеры 256 × 192 и опору (128,176). Верхние — `obstacles/overhead/level-{3,4}-variant-{0..3}.png`, 200 × 160, опора (100,155). Бонусы — `bonuses/world-{3,4}.png`, 64 × 64.
Враги: `kikimora`, `vodyanoy`, `sandworm`, `desert-guard`; лист 768 × 192, четыре кадра 192 × 192 с дыхательным движением. Правила урона и наград прежние.

Первый мир фиксирован. Остальные четыре переставляются алгоритмом Fisher–Yates с LCG по seed попытки. Номер этапа (`level`) отделён от индекса мира (`world`); сервер передаёт оба значения. Клиент и сервер используют одинаковую последовательность (seed 42 → 0,3,4,1,2).

Пол первого уровня: `../art/level-1-floor.png`, исходный прозрачный PNG пользователя 2172 × 724, без генерации и обработки. Рисуется отдельным слоем в локальной и сетевой игре: линия опоры y=320 исходника, пропорции сохранены, нижняя часть обрезается краем дорожки. Прокрутка со скоростью препятствий, вторая плитка зеркальная.

## Combat and terrain v2 (2026-10-31)

Active enemies now use `enemies/{key}-v2.png`: seven 192 × 192 frames, origin (96,192). Frames 0–3 loop at 6 fps; defeat uses 4, 5, 6 for 160 ms each, then fades for 200 ms. Sources and prompts are in `enemies/generated/`.

`spells/{sofia,stella,air,earth,kai,leya}.png`: four 128 × 96 frames, centered origin, 80 ms per frame. Generated sources and prompts are in `spells/generated/`. Rebuild both groups with `scripts/prepare_combat_v2.py`. Phaser and online Canvas share these resources. Terrain artwork is code-native in `src/terrain-art.ts`.

Music and elemental sounds are original procedural Web Audio compositions in `src/audio.ts`, requiring no recorded third-party assets. Five eight-note world motifs, independent persisted music/effects settings, gesture unlock, bounded polyphony and bonus throttling.

## Obstacle animation release v1.1.0 (historical)

Shared padded atlases live in `animated/`; both renderers use `src/obstacle-animation-data.ts` and game-time frame selection. Each idle loop contains four authored poses played as eight phases (0,1,2,3,3,2,1,0), at 8 fps for obstacles and 6 fps for enemies. Enemy defeat frames 8–10 retain the previous artwork and timing. Packed cells include 8 px padding per side and at least 4 px of fully transparent outer gutter. Registration uses the static lower support and one common scale per cycle.

ImageGen sources and prompts are retained outside the public bundle in `pics/obstacle-animations/`. Reproduce this intermediate release with `python scripts/prepare_obstacle_animations.py --existing-enemies` (Pillow required); validate with `python scripts/check_obstacle_animations.py`. All enemy idle poses currently come from the previous reviewed sheets. The incomplete root arch temporarily reuses the complete wooden arch. Remaining generation and clearance review are tracked in [the next-iteration plan](../../docs/obstacle-animation-next-iteration.md).

## Obstacle animation release v1.2.0

All 35 atlas entries now use retained ImageGen sources, including new ready poses for all ten enemies. Three original defeat frames remain unchanged. The root arch is a complete independent asset; temporary old-enemy and wooden-arch substitutions have been removed. Sakura/lantern, pine/crane, candy tree/sweet, and antenna/drone sources have been revised for higher hanging details.

Rebuild the current set with `python scripts/prepare_obstacle_animations.py`; the old `--existing-enemies` flag is no longer supported. New sources use 2×2 pose grids described by sibling `*.layout.json`; legacy sources default to 4×2. The common four-pose forward/backward playback, padded cell dimensions and origins are preserved. Original attempts remain as versioned source PNGs/prompts. Current status, checks and further real-device review are recorded in [the iteration document](../../docs/obstacle-animation-next-iteration.md).
