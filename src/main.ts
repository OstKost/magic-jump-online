import { SPELLS } from './combat';
import { drawSpell } from './combat-art';
import { ENEMIES, SPELL_COOLDOWN_MS, SPELL_RANGE, SPELL_SPEED, ENEMY_REWARD, ENEMY_FALL_MS, firstSpellTarget } from './combat';
import Phaser from 'phaser';
import { installMenuKeyboard } from './menu-keyboard';
import { cueOffset, cueFrame, consumeCue, type TutorialCue } from './tutorial-cues';
import { api, mountNetwork, nameForms, drawArch, type Action, type Attempt } from './network';
import './style.css';
import { CHARACTERS, portraitMarkup, petMarkup } from './characters';
import { Journey } from './journey';
import { Pet } from './pets';
import { ElementMagic } from './element-magic';
import { WorldBackground } from './backgrounds';
import { obstacleCollision, award, GRAVITY, hit, JUMP_VELOCITY, LEVEL_SECONDS, newPlayer, route, worldOrder, WORLDS, jumpVelocity, DIFFICULTIES, type DifficultyKey, type DifficultyConfig, type ObstacleType, type Player, type Spawn } from './rules';
import { initPWA, showToast } from './pwa';
import { ExitConfirmationController } from './confirm-exit';
import { RankingFlowController, openSkipConfirm, syncPendingRankings } from './ranking.ts';

const journey = new Journey();
const heroFor = (row: number) => CHARACTERS[journey.selected[row]];
let adventure: Adventure | undefined;
let attempt: Attempt | undefined;
let logs: Action[][] = Array.from({length: WORLDS.length}, () => []);
let startingLocal=false;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<main class="mobile-app">
<section id="splash" class="screen splash" tabindex="0" role="button" aria-label="Нажмите любую кнопку или коснитесь экрана, чтобы открыть меню">
  <div class="splash-title"><span class="eyebrow">МАГИ СТИХИЙ</span><h1>Волшебный<br><em>Прыжок Онлайн</em></h1><p class="tagline">Вместе сквозь миры</p></div>
  <div class="splash-bottom"><div class="screen-pets">${petMarkup(CHARACTERS[0])}${petMarkup(CHARACTERS[1])}</div><p class="press-any">Нажмите любую кнопку</p><small>или коснитесь экрана</small></div>
</section>
<section id="home" class="home screen" hidden>
  <div class="home-content">
    <div class="home-crest" aria-hidden="true">水</div>
    <h1>Волшебный<br><em>Прыжок Онлайн</em></h1>
    <p class="tagline">Вместе сквозь миры</p><div class="ornament" aria-hidden="true">──── ◇ ────</div>
    <nav class="home-menu" aria-label="Главное меню">
      <button id="play-menu" class="menu-item menu-featured"><span class="menu-icon" aria-hidden="true">水</span><span>2 игрока</span></button>
      <button id="solo-menu" class="menu-item">1 игрок</button>
      <button id="online-menu" class="menu-item"><span class="menu-label">Онлайн</span><span class="menu-status" hidden>нет интернета</span></button><button id="ranking-menu" class="menu-item">Рейтинг</button>
      <button id="install-menu" class="menu-item"><span class="menu-icon" aria-hidden="true">⬇</span><span class="install-text">Скачать игру</span></button>
      <button id="settings-open" class="menu-item"><span class="menu-icon" aria-hidden="true">⚙</span><span>Настройки</span></button>
      <button id="exit-menu" class="menu-item"><span class="menu-icon" aria-hidden="true">⇥</span><span>Выход</span></button>
    </nav>
    <div class="screen-pets home-pets" id="home-pets">${petMarkup(CHARACTERS[0])}${petMarkup(CHARACTERS[1])}</div>
  </div>
</section>
<section id="farewell" class="screen farewell" hidden><span class="home-crest" aria-hidden="true">水</span><h2>До новых встреч</h2><p>София и Стелла будут ждать вас.</p><button class="secondary back-home">Вернуться в меню</button></section>
<section id="difficulty-select" class="screen panel difficulty-select" hidden>
  <div class="panel-top">
    <button id="difficulty-back" class="icon-button back-home" aria-label="Назад в меню">←</button>
    <span class="screen-label">ПОДГОТОВКА К ПУТЕШЕСТВИЮ</span>
    <span class="difficulty-step-badge">ШАГ 1 ИЗ 2</span>
  </div>
  <div class="panel-heading difficulty-heading">
    <span class="eyebrow" id="difficulty-mode-label">ВЫБОР СЛОЖНОСТИ</span>
    <h2>Уровень сложности</h2>
    <p class="panel-subtitle">Выберите темп забега и число сердечек для вашего путешествия</p>
    <div class="ornament" aria-hidden="true">──── ◇ ────</div>
  </div>
  <div class="difficulty-grid">
    <button class="difficulty-card" data-difficulty="easy" aria-label="Лёгкая сложность">
      <div class="difficulty-card-badge easy-badge">🌸 Для самых маленьких</div>
      <div class="difficulty-card-header">
        <span class="difficulty-card-icon" aria-hidden="true">🌸</span>
        <div>
          <h3 class="difficulty-card-title">Лёгкий</h3>
          <span class="difficulty-card-time">⏱ 20 секунд на мир</span>
        </div>
      </div>
      <div class="difficulty-card-stats">
        <div class="stat-item"><span class="stat-icon">❤️</span><span>Жизни:</span><strong>4 ♥♥♥♥</strong></div>
        <div class="stat-item"><span class="stat-icon">🐢</span><span>Скорость:</span><strong>×0.9 (спокойная)</strong></div>
        <div class="stat-item"><span class="stat-icon">🪨</span><span>Препятствия:</span><strong>Как обычно</strong></div>
      </div>
      <p class="difficulty-card-hint">Меньше времени, спокойный бег и четыре сердечка — легко освоиться и победить!</p>
      <div class="difficulty-card-btn"><span>Выбрать лёгкий →</span></div>
    </button>

    <button class="difficulty-card featured" data-difficulty="medium" aria-label="Средняя сложность">
      <div class="difficulty-card-badge medium-badge">⭐ Золотая середина</div>
      <div class="difficulty-card-header">
        <span class="difficulty-card-icon" aria-hidden="true">⭐</span>
        <div>
          <h3 class="difficulty-card-title">Средний</h3>
          <span class="difficulty-card-time">⏱ 40 секунд на мир</span>
        </div>
      </div>
      <div class="difficulty-card-stats">
        <div class="stat-item"><span class="stat-icon">❤️</span><span>Жизни:</span><strong>3 ♥♥♥</strong></div>
        <div class="stat-item"><span class="stat-icon">⚡</span><span>Скорость:</span><strong>×1.0 (стандарт)</strong></div>
        <div class="stat-item"><span class="stat-icon">🪵</span><span>Препятствия:</span><strong>Чуть больше</strong></div>
      </div>
      <p class="difficulty-card-hint">Классическое приключение для дружной пары героев. Золотой стандарт игры!</p>
      <div class="difficulty-card-btn"><span>Выбрать средний →</span></div>
    </button>

    <button class="difficulty-card" data-difficulty="hard" aria-label="Сложная сложность">
      <div class="difficulty-card-badge hard-badge">🔥 Испытание стихий</div>
      <div class="difficulty-card-header">
        <span class="difficulty-card-icon" aria-hidden="true">🔥</span>
        <div>
          <h3 class="difficulty-card-title">Сложный</h3>
          <span class="difficulty-card-time">⏱ 50 секунд на мир</span>
        </div>
      </div>
      <div class="difficulty-card-stats">
        <div class="stat-item"><span class="stat-icon">❤️</span><span>Жизни:</span><strong>3 ♥♥♥</strong></div>
        <div class="stat-item"><span class="stat-icon">🚀</span><span>Скорость:</span><strong>×1.05 (бодрая)</strong></div>
        <div class="stat-item"><span class="stat-icon">🌪️</span><span>Препятствия:</span><strong>Частые</strong></div>
      </div>
      <p class="difficulty-card-hint">Динамичный темп и частые прыжки. Потребуется сноровка, но детям 8–10 лет под силу!</p>
      <div class="difficulty-card-btn"><span>Выбрать сложный →</span></div>
    </button>
  </div>
</section>
<section id="character-select" class="screen character-select" hidden>
  <header class="selection-header"><button id="selection-back" class="icon-button" aria-label="Назад">←</button><span class="eyebrow">СОБЕРИТЕ СВОЮ КОМАНДУ</span><span id="selection-step">01 / 02</span></header>
  <div class="selection-heading"><span class="eyebrow" id="choosing-player">ИГРОК 1</span><h2>Выберите персонажа</h2><p id="selection-hint">Ваш верный спутник отправится вместе с вами.</p></div>
  <div id="secret-banner" class="secret-banner" hidden>✨ Секрет открыт: Кай и Лея присоединились к магам!</div>
  <div class="character-grid" id="character-grid"></div>
  <footer class="selection-footer"><div id="party-preview" class="party-preview"></div><button id="confirm-character" class="primary">Подтвердить →</button></footer>
</section>
<section id="result" class="screen result-screen" hidden><div class="result-content"><span class="eyebrow" id="result-eyebrow"></span><h2 id="result-title"></h2><p id="result-description"></p><div id="result-party" class="result-party"></div><div id="result-scores" class="result-scores"></div><div id="result-ranking" class="result-ranking"></div><button id="result-next" class="primary"></button><button id="result-menu" class="secondary">В главное меню</button></div></section>
<section id="play-screen" class="screen play-screen" hidden>
<div class="player-controls sofia"><button class="jump sofia" data-jump="0" aria-label="Прыжок первого игрока, Софии"><span class="jump-element">水</span><small>ИГРОК 1</small><strong>София</strong><span class="jump-glyph">↟</span><span class="jump-action">Прыжок</span><kbd>W</kbd></button><button class="duck-control" data-duck="0" aria-label="Присед Софии"><span>↧</span><strong>Присед</strong><small>Удерживайте</small><kbd>S</kbd></button></div>
<div class="play-center"><div class="arena-wrap"><div id="game"></div>
<div class="lane-label top"><span class="avatar lavender">水</span><div><strong>Игрок 1 · София</strong><span id="lives-0">♥ ♥ ♥</span></div><b id="score-0">0 <small>очков</small></b></div>
<div class="lane-label bottom"><span class="avatar mint">火</span><div><strong>Игрок 2 · Стелла</strong><span id="lives-1">♥ ♥ ♥</span></div><b id="score-1">0 <small>очков</small></b></div>
<div class="arena-toolbar"><button id="home-button" class="icon-button" aria-label="В меню">⌂</button><span id="world-title">Горы небожителей</span><span class="timer" id="timer">01:00</span><button id="pause" class="icon-button" aria-label="Пауза" disabled>Ⅱ</button></div>
<div id="level-intro" class="level-intro" hidden><div class="location-title"><span class="location-ornament" aria-hidden="true">✦ ─── ✧ ─── ✦</span><h2></h2><span class="location-subtitle"></span></div><div class="start-countdown" role="status" aria-live="assertive" aria-atomic="true"></div></div><div id="overlay" class="overlay" hidden></div></div></div>
<div class="player-controls stella"><button class="jump stella" data-jump="1" aria-label="Прыжок второго игрока, Стеллы"><span class="jump-element">火</span><small>ИГРОК 2</small><strong>Стелла</strong><span class="jump-glyph">↟</span><span class="jump-action">Прыжок</span><kbd>↑</kbd></button><button class="duck-control" data-duck="1" aria-label="Присед Стеллы"><span>↧</span><strong>Присед</strong><small>Удерживайте</small><kbd>↓</kbd></button></div>
<div class="rotate-notice"><span>⤾</span><h2>Поверните телефон</h2><p>Играйте горизонтально: София слева, Стелла справа.<br>Две дорожки — в центре экрана.</p><button id="rotate-home" class="secondary">Вернуться в меню</button></div>
<div id="confirm-exit-dialog" class="confirm-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-exit-title" hidden>
  <div class="confirm-exit-backdrop" id="confirm-exit-backdrop"></div>
  <div class="confirm-exit-box">
    <div class="confirm-exit-content">
      <span class="confirm-exit-icon" aria-hidden="true">⌂</span>
      <div class="confirm-exit-text">
        <h3 id="confirm-exit-title">Выйти в главное меню?</h3>
        <p>Текущий забег будет прерван</p>
      </div>
    </div>
    <div class="confirm-exit-actions">
      <button id="confirm-exit-cancel" type="button" class="confirm-exit-btn confirm-exit-btn-cancel">Продолжить игру</button>
      <button id="confirm-exit-yes" type="button" class="confirm-exit-btn confirm-exit-btn-exit">Выйти</button>
    </div>
  </div>
</div>
<div id="confirm-skip-dialog" class="confirm-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-skip-title" hidden>
  <div class="confirm-exit-backdrop" id="confirm-skip-backdrop"></div>
  <div class="confirm-exit-box">
    <div class="confirm-exit-content">
      <span class="confirm-exit-icon" aria-hidden="true">✕</span>
      <div class="confirm-exit-text">
        <h3 id="confirm-skip-title">Пропустить сохранение рейтинга?</h3>
        <p id="confirm-skip-desc">Результат не будет записан в таблицу рекордов.</p>
      </div>
    </div>
    <div class="confirm-exit-actions">
      <button id="confirm-skip-cancel" type="button" class="confirm-exit-btn confirm-exit-btn-cancel">Вернуться</button>
      <button id="confirm-skip-yes" type="button" class="confirm-exit-btn confirm-exit-btn-exit">Да, пропустить</button>
    </div>
  </div>
</div>
</section>
<section id="settings" class="screen panel settings-screen" hidden>
  <div class="panel-top">
    <button class="icon-button back-home" aria-label="Назад">←</button>
    <span class="screen-label">ВОЛШЕБНЫЙ СВИТОК</span>
    <span class="screen-ornament" aria-hidden="true">✦</span>
  </div>
  <div class="panel-heading">
    <span class="eyebrow">НАСТРОЙКИ И ПРАВИЛА</span>
    <h2>Секреты мастеров стихий</h2>
    <p class="panel-subtitle">Всё для лёгкой победы и удобной игры — понятно даже самым юным героям!</p>
    <div class="ornament" aria-hidden="true">──── ◇ ────</div>
  </div>
  <div class="settings-controls-group">
    <div class="setting-card">
      <div class="setting-info">
        <span class="setting-icon" aria-hidden="true">🔊</span>
        <div>
          <strong>Звуковые эффекты</strong>
          <small>Звон сладких бонусов, магия прыжков и фанфары</small>
        </div>
      </div>
      <button id="sound" class="setting-toggle" aria-label="Переключить звук">
        <span id="sound-state" class="setting-badge">Выкл.</span>
      </button>
    </div>
    <div class="setting-card">
      <div class="setting-info">
        <span class="setting-icon" aria-hidden="true">📳</span>
        <div>
          <strong>Вибрация</strong>
          <small>Лёгкая отдача в руках при толчке от земли на телефоне</small>
        </div>
      </div>
      <button id="vibration" class="setting-toggle" aria-label="Переключить вибрацию">
        <span id="vibration-state" class="setting-badge">Вкл.</span>
      </button>
    </div>
    <div class="setting-card setting-download-card">
      <div class="setting-info">
        <span class="setting-icon" aria-hidden="true">📲</span>
        <div>
          <strong>Установка на телефон или компьютер</strong>
          <small>Игра во весь экран, без рамок и без интернета</small>
        </div>
      </div>
      <button id="install-settings" class="secondary-btn go-install" aria-label="Открыть страницу установки">
        <span>Инструкция →</span>
      </button>
    </div>
  </div>
  <div class="guide-section">
    <div class="guide-header">
      <span class="eyebrow">КАК ИГРАТЬ</span>
      <h3>Школа волшебных прыжков</h3>
      <p>Простые правила, чтобы пробежать все миры и поставить рекорд!</p>
    </div>
    <div class="guide-cards">
      <article class="guide-card">
        <div class="guide-badge gold">🌟 Главная цель</div>
        <h4>Бегите вперёд и берегите сердечки!</h4>
        <p>Ваша дружная команда бежит через пять сказочных миров. Перепрыгивайте ловушки, собирайте волшебные сладости и доберитесь до финиша! У каждого героя есть <strong>3 сердечка ♥♥♥</strong>.</p>
        <div class="guide-tip">
          <span class="tip-icon">💡</span>
          <span>Потеряли сердечко? Не переживайте! Через секунду вы снова неуязвимы, а в следующем мире все 3 жизни полностью восстановятся!</span>
        </div>
      </article>
      <article class="guide-card">
        <div class="guide-badge blue">🐾 Главные движения</div>
        <h4>Прыжок и Присед</h4>
        <div class="moves-grid">
          <div class="move-item">
            <span class="move-glyph">⬆️</span>
            <div>
              <strong>Прыжок</strong>
              <p>Перепрыгивайте через острые камни, колючки и брёвна на земле.</p>
            </div>
          </div>
          <div class="move-item">
            <span class="move-glyph">✨</span>
            <div>
              <strong>Двойной прыжок!</strong>
              <p>Нажмите прыжок ещё раз <em>прямо в воздухе</em> — героиня сделает волшебный кувырок с искрами магии, взлетит вдвое выше и поймает парящий в небе бонус!</p>
            </div>
          </div>
          <div class="move-item">
            <span class="move-glyph">⬇️</span>
            <div>
              <strong>Присед (удерживайте)</strong>
              <p>Когда впереди деревянная арка или мостик — <em>зажмите и держите</em> кнопку приседа, пока не пробежите под препятствием.</p>
            </div>
          </div>
        </div>
      </article>
      <article class="guide-card">
        <div class="guide-badge red">👥 Играем вдвоём</div>
        <h4>Управление на телефоне и компьютере</h4>
        <div class="controls-guide-grid">
          <div class="control-scheme">
            <span class="scheme-title">📱 На телефоне или планшете:</span>
            <p>Держите экран горизонтально двумя руками:</p>
            <ul>
              <li><strong>Левая рука</strong> — София (Вода 水). Вверху прыжок, внизу присед.</li>
              <li><strong>Правая рука</strong> — Стелла (Огонь 火). Вверху прыжок, внизу присед.</li>
            </ul>
          </div>
          <div class="control-scheme">
            <span class="scheme-title">💻 На компьютере с клавиатуры:</span>
            <div class="keys-list">
              <div class="player-keys">
                <strong>Игрок 1 (София):</strong>
                <span><kbd>W</kbd> — Прыжок</span>
                <span><kbd>S</kbd> — Присед</span>
              </div>
              <div class="player-keys">
                <strong>Игрок 2 (Стелла):</strong>
                <span><kbd>↑</kbd> — Прыжок</span>
                <span><kbd>↓</kbd> — Присед</span>
              </div>
            </div>
            <p class="pause-tip"><kbd>Escape</kbd> — пауза (можно передохнуть в любой момент).</p>
          </div>
        </div>
      </article>
      <article class="guide-card">
        <div class="guide-badge green">🍬 Очки и подарки</div>
        <h4>Копите баллы для победы!</h4>
        <div class="scoring-list">
          <div class="score-row">
            <span class="score-icon">🪨</span>
            <span class="score-desc">Перепрыгнули препятствие</span>
            <strong class="score-val">+10 очков</strong>
          </div>
          <div class="score-row">
            <span class="score-icon">🍬</span>
            <span class="score-desc">Поймали конфету или ягодку</span>
            <strong class="score-val">+25 очков</strong>
          </div>
          <div class="score-row">
            <span class="score-icon">👻</span>
            <span class="score-desc">Режим призрака (если жизни кончились)</span>
            <strong class="score-val">Помощь другу!</strong>
          </div>
        </div>
        <p class="scoring-note">В режиме призрака вы продолжаете весело бежать вместе с напарником и зарабатывать очки для общего рекорда!</p>
      </article>
      <article class="guide-card">
        <div class="guide-badge purple">🐱 Питомцы и пять миров</div>
        <h4>Верные друзья всегда рядом</h4>
        <p>Рядом с каждой героиней бежит её верный спутник — кот Черныш, кот Рыжик, гордый Орёл или ловкая Лисичка. Они подбадривают вас во всех пяти мирах:</p>
        <div class="worlds-mini-list">
          <div class="world-mini-item">
            <span>⛰️</span>
            <div><strong>Горы небожителей</strong> — лёгкий старт над белыми облаками.</div>
          </div>
          <div class="world-mini-item">
            <span>🍭</span>
            <div><strong>Конфетный мир</strong> — сладкие леденцы, ягодный зефир и скорость выше!</div>
          </div>
          <div class="world-mini-item">
            <span>🪐</span>
            <div><strong>Млечный путь</strong> — космический бег среди сияющих звёзд!</div>
          </div>
          <div class="world-mini-item"><span>🌿</span><div><strong>Топь</strong> — туманное болото русских сказок.</div></div>
          <div class="world-mini-item"><span>🏜️</span><div><strong>Дюна</strong> — барханы и тайны древних руин.</div></div>
        </div>
        <p>Первый мир всегда учебный, остальные встречаются в случайном порядке без повторений.</p>
      </article>
    </div>
  </div>
  <div class="settings-footer-actions">
    <button class="primary back-home">В главное меню ←</button>
  </div>
</section>
<section id="install" class="screen panel install-screen" hidden>
  <div class="panel-top">
    <button class="icon-button back-home" aria-label="Назад">←</button>
    <span class="screen-label">ПРИЛОЖЕНИЕ ДЛЯ УСТРОЙСТВА</span>
    <span class="screen-ornament" aria-hidden="true">✦</span>
  </div>
  <div class="panel-heading">
    <span class="eyebrow">УСТАНОВКА ИГРЫ</span>
    <h2>Волшебный Прыжок</h2>
    <p class="panel-subtitle">Установите игру на телефон, планшет или компьютер. Играйте на весь экран, без рамок браузера и даже без интернета!</p>
    <div class="ornament" aria-hidden="true">──── ◇ ────</div>
  </div>
  <div class="install-hero-card">
    <div class="install-hero-badge">
      <img src="/icons/icon-192.png" alt="Иконка Волшебный Прыжок" class="install-app-icon" />
      <div class="install-hero-info">
        <h3>Волшебный Прыжок Онлайн</h3>
        <p id="install-device-status">Готово к установке на ваше устройство</p>
      </div>
    </div>
    <div class="install-hero-actions">
      <button id="direct-install-btn" class="primary install-action-btn" data-install-btn>
        <span class="install-text">Установить игру сейчас</span> <span aria-hidden="true">✦</span>
      </button>
    </div>
  </div>
  <div class="install-benefits">
    <div class="benefit-item">
      <span class="benefit-icon">✈️</span>
      <strong>Без интернета</strong>
      <small>Играйте в поездках, самолёте или на даче</small>
    </div>
    <div class="benefit-item">
      <span class="benefit-icon">🎮</span>
      <strong>Во весь экран</strong>
      <small>Без лишних кнопок, вкладок и адресной строки</small>
    </div>
    <div class="benefit-item">
      <span class="benefit-icon">⚡</span>
      <strong>Быстрый вход</strong>
      <small>Запуск в одно касание прямо с рабочего стола</small>
    </div>
    <div class="benefit-item">
      <span class="benefit-icon">💾</span>
      <strong>Мало места</strong>
      <small>Не забивает память устройства</small>
    </div>
  </div>
  <div class="install-instructions-section">
    <div class="platform-tabs" role="tablist" aria-label="Выбор платформы">
      <button class="platform-tab active" data-tab="android" role="tab" aria-selected="true">
        <span>📱</span> Android
      </button>
      <button class="platform-tab" data-tab="ios" role="tab" aria-selected="false">
        <span>🍏</span> iPhone / iPad
      </button>
      <button class="platform-tab" data-tab="desktop" role="tab" aria-selected="false">
        <span>💻</span> Компьютер
      </button>
    </div>
    <div id="tab-android" class="tab-pane active" role="tabpanel">
      <div class="platform-guide-card">
        <div class="platform-guide-header">
          <span class="guide-tag">Google Chrome · Яндекс.Браузер · Samsung Internet</span>
          <h4>Как установить на Android</h4>
        </div>
        <ol class="step-list">
          <li class="step-item">
            <span class="step-num">1</span>
            <div class="step-content">
              <strong>Нажмите меню браузера</strong>
              <p>Найдите значок <strong>три точки ⋮</strong> в правом верхнем углу (в Яндекс.Браузере — внизу экрана).</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">2</span>
            <div class="step-content">
              <strong>Выберите установку</strong>
              <p>В появившемся меню нажмите пункт <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">3</span>
            <div class="step-content">
              <strong>Подтвердите и играйте!</strong>
              <p>Нажмите <strong>«Установить»</strong>. Значок игры с волшебным котиком появится на рабочем столе телефона среди ваших приложений.</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
    <div id="tab-ios" class="tab-pane" role="tabpanel" hidden>
      <div class="platform-guide-card">
        <div class="platform-guide-header">
          <span class="guide-tag">Safari на iPhone и iPad</span>
          <h4>Как установить на устройства Apple</h4>
        </div>
        <ol class="step-list">
          <li class="step-item">
            <span class="step-num">1</span>
            <div class="step-content">
              <strong>Откройте в Safari</strong>
              <p>Убедитесь, что игра открыта в стандартном браузере <strong>Safari</strong> (на iOS добавление на экран работает через Safari).</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">2</span>
            <div class="step-content">
              <strong>Нажмите кнопку «Поделиться»</strong>
              <p>В нижней панели Safari найдите значок квадрата со стрелочкой вверх <span class="ios-glyph">⎋</span>.</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">3</span>
            <div class="step-content">
              <strong>Выберите «На экран «Домой»»</strong>
              <p>Пролистайте меню немного вниз и нажмите строчку с плюсиком <strong>«На экран «Домой»»</strong> <span class="ios-glyph">⊞</span>.</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">4</span>
            <div class="step-content">
              <strong>Нажмите «Добавить»</strong>
              <p>В правом верхнем углу нажмите <strong>«Добавить»</strong>. Игра появится на домашнем экране и будет запускаться на весь экран без адресной строки!</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
    <div id="tab-desktop" class="tab-pane" role="tabpanel" hidden>
      <div class="platform-guide-card">
        <div class="platform-guide-header">
          <span class="guide-tag">Windows · macOS · Linux (Chrome, Edge, Яндекс)</span>
          <h4>Как установить на компьютер или ноутбук</h4>
        </div>
        <ol class="step-list">
          <li class="step-item">
            <span class="step-num">1</span>
            <div class="step-content">
              <strong>Найдите иконку в адресной строке</strong>
              <p>Справа в строке с адресом сайта нажмите на значок <strong>компьютера со стрелочкой</strong> ⤓ («Установить Волшебный Прыжок»).</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">2</span>
            <div class="step-content">
              <strong>Либо откройте меню браузера</strong>
              <p>Нажмите <strong>три точки ⋮</strong> в правом верхнем углу браузера и выберите пункт <strong>«Установить приложение...»</strong>.</p>
            </div>
          </li>
          <li class="step-item">
            <span class="step-num">3</span>
            <div class="step-content">
              <strong>Готово! Играйте в отдельном окне</strong>
              <p>Нажмите <strong>«Установить»</strong>. Игра запустится в удобном окне без лишних вкладок, а ярлык появится на рабочем столе.</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </div>
  <div class="install-footer-actions">
    <button class="primary back-home">В главное меню ←</button>
  </div>
</section>
<div id="offline-badge" class="offline-badge" hidden></div>
<div id="ios-install-dialog" class="pwa-dialog-overlay" hidden>
  <div class="pwa-dialog-card" role="dialog" aria-modal="true" aria-labelledby="ios-dialog-title">
    <div class="pwa-dialog-header">
      <span class="eyebrow">PWA УСТАНОВКА</span>
      <h3 id="ios-dialog-title">Как скачать на iPhone / iPad</h3>
    </div>
    <ol class="ios-steps">
      <li>Нажмите кнопку <strong>«Поделиться»</strong> <span class="ios-glyph">⎋</span> в нижней панели Safari.</li>
      <li>Пролистайте меню и выберите <strong>«На экран «Домой»»</strong> <span class="ios-glyph">⊞</span>.</li>
      <li>В правом верхнем углу нажмите <strong>«Добавить»</strong>.</li>
    </ol>
    <p class="ios-dialog-note">После этого иконка «Волшебный Прыжок» появится на рабочем столе и будет запускаться на весь экран без рамок браузера.</p>
    <button class="primary close-ios-dialog">Понятно</button>
  </div>
</div>
</main>`;
installMenuKeyboard(app);

// Freeze the menu while its chosen action flashes three times.
const homeMenu = document.querySelector<HTMLElement>('.home-menu')!;
let confirmingMenu = false;
let confirmedMenuClick = false;
homeMenu.addEventListener('click', async event => {
  if (confirmedMenuClick) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (confirmingMenu) return;
  confirmingMenu = true;
  homeMenu.inert = true;
  homeMenu.setAttribute('aria-busy', 'true');
  button.classList.add('menu-active');
  try {
    await button.animate([
      { opacity: 1 }, { opacity: .2, offset: .5 }, { opacity: 1 },
    ], { duration: 280, iterations: 3, easing: 'steps(1, end)' }).finished;
    confirmedMenuClick = true;
    button.click();
  } finally {
    confirmedMenuClick = false;
    confirmingMenu = false;
    homeMenu.inert = false;
    homeMenu.removeAttribute('aria-busy');
    button.classList.remove('menu-active');
  }
}, { capture: true });

function showScreen(id: string) {
  adventure?.scene.setVisible(id==='play-screen');
  document.querySelectorAll<HTMLElement>('.screen').forEach(el=>{el.hidden=el.id!==id;});
  document.querySelector('.mobile-app')!.classList.toggle('is-playing',id==='play-screen');
  if(id==='home') document.querySelector('#home-pets')!.innerHTML=journey.selected.map(i=>petMarkup(CHARACTERS[i])).join('');
}
let opening = false;
function openMenu() {
  const splash=document.querySelector<HTMLElement>('#splash')!;
  if(splash.hidden || opening)return;
  opening=true;splash.classList.add('is-leaving');
  window.setTimeout(()=>{showScreen('home');document.querySelector<HTMLElement>('#play-menu')!.focus();opening=false;},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);
}
document.querySelector('#splash')!.addEventListener('pointerdown',openMenu);
window.addEventListener('keydown',event=>{if(!document.querySelector<HTMLElement>('#splash')!.hidden&&!['Shift','Control','Alt','Meta'].includes(event.key)){event.preventDefault();openMenu();}});
function readSetting(key:string, fallback:string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function saveSetting(key:string,value:string) { try { localStorage.setItem(key,value); } catch {} }
let vibration=readSetting('vibration','true')==='true';
function updateVibrationUI(){const el=document.querySelector('#vibration-state');if(el){el.textContent=vibration?'Вкл.':'Выкл.';el.classList.toggle('is-on',vibration);}}
let audio: AudioContext | undefined;
let sound = readSetting('sound','false')==='true';
function beep(freq: number) { if (!sound) return; try { audio ??= new AudioContext(); void audio.resume(); const o=audio.createOscillator(), g=audio.createGain(); o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.start();o.stop(audio.currentTime+.12); } catch {} }

let stellaClicks = 0;
let secretUnlocked = readSetting('secret_heroes_unlocked', 'false') === 'true';

function showSecretBanner(text: string) {
  const banner = document.querySelector<HTMLElement>('#secret-banner');
  if (!banner) return;
  banner.textContent = text;
  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add('is-active'));
  setTimeout(() => {
    banner.classList.remove('is-active');
    setTimeout(() => { banner.hidden = true; }, 300);
  }, 4500);
}

function unlockSecret(silent = false) {
  if (secretUnlocked) return;
  secretUnlocked = true;
  saveSetting('secret_heroes_unlocked', 'true');
  if (!silent) {
    showSecretBanner('✨ Секрет открыт: Кай и Лея присоединились к магам!');
    beep(523);
    setTimeout(() => beep(659), 100);
    setTimeout(() => beep(784), 200);
    setTimeout(() => beep(1046), 300);
    if (vibration && 'vibrate' in navigator) {
      try { navigator.vibrate([100, 50, 100, 50, 200]); } catch {}
    }
  }
  renderSelection();
}

function renderSelection() {
  const row=journey.choosing;
  document.querySelector('#choosing-player')!.textContent=`ИГРОК ${row+1} · ${row===0?'СЛЕВА':'СПРАВА'}`;
  document.querySelector('#selection-step')!.textContent=`0${row+1} / 0${journey.count}`;
  const availableHeroes = secretUnlocked ? CHARACTERS : CHARACTERS.slice(0, 4);
  document.querySelector('#character-grid')!.innerHTML=availableHeroes.map((hero,i)=>`<button class="character-card ${journey.selected[row]===i?'selected':''}" data-character="${i}" style="--hero-color:${hero.color}" aria-pressed="${journey.selected[row]===i}" ${row===1&&journey.selected[0]===i?'disabled':''}>${portraitMarkup(hero)}<span class="character-name">${hero.name}</span><span class="character-element">${hero.symbol} · ${hero.element}</span>${petMarkup(hero)}<small>${row===1&&journey.selected[0]===i?'Выбран игроком 1':hero.petName}</small></button>`).join('');
  document.querySelectorAll<HTMLElement>('[data-character]').forEach(button=>button.addEventListener('click',()=>{
    const idx = Number(button.dataset.character);
    if (idx === 1 && !secretUnlocked) {
      stellaClicks++;
      if (stellaClicks >= 5) {
        unlockSecret();
        journey.choose(idx);
        return;
      } else {
        beep(400 + stellaClicks * 70);
      }
    }
    if(journey.choose(idx))renderSelection();
  }));
  document.querySelector('#party-preview')!.innerHTML=journey.selected.map((_,i)=>`<span class="party-slot ${i===row?'current':''}"><small>ИГРОК ${i+1}</small><b>${i<=row?heroFor(i).name:'Ожидает выбора'}</b></span>`).join('');
  const confirm=document.querySelector<HTMLButtonElement>('#confirm-character')!;confirm.disabled=!adventure;confirm.textContent=adventure?(row===0?'Выбрать для игрока 1 →':'Отправиться вместе →'):'Загрузка персонажей…';
}
document.querySelector('#selection-back')!.addEventListener('click',()=>{if(journey.choosing===1){journey.choosing=0;renderSelection();}else showScreen('difficulty-select');});
document.querySelector('#confirm-character')!.addEventListener('click',()=>{if(!adventure)return;if(journey.confirm()){showScreen('play-screen');adventure.prepareLevel(true);}else renderSelection();});

let pendingCount = 2;
let selectedDifficulty: DifficultyKey = 'medium';

function openDifficultySelect(count: number) {
  pendingCount = count;
  const label = document.querySelector<HTMLElement>('#difficulty-mode-label');
  if (label) label.textContent = count === 1 ? 'ОДИНОЧНЫЙ РЕЖИМ · 1 ИГРОК' : 'РЕЖИМ НА ДВОИХ · 2 ИГРОКА';
  showScreen('difficulty-select');
}

document.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = (btn.dataset.difficulty as DifficultyKey) || 'medium';
    selectedDifficulty = diff;
    void startLocal(pendingCount, diff);
  });
});

document.querySelector('#settings-open')!.addEventListener('click',()=>showScreen('settings'));
document.querySelector('#install-menu')?.addEventListener('click',()=>showScreen('install'));
document.querySelector('#install-settings')?.addEventListener('click',()=>showScreen('install'));
document.querySelectorAll('.go-install').forEach(btn=>btn.addEventListener('click',()=>showScreen('install')));
document.querySelector('#exit-menu')!.addEventListener('click',()=>{showScreen('farewell');if(document.fullscreenElement)void document.exitFullscreen();});
async function startLocal(count:number, difficulty: DifficultyKey = selectedDifficulty){
  if(startingLocal)return;
  startingLocal=true;
  selectedDifficulty = difficulty;
  try{attempt=await api<Attempt>('attempts',{count, difficulty});}catch{attempt=undefined;}finally{startingLocal=false;}
  logs=Array.from({length: WORLDS.length}, () => []);
  journey.count=count;
  document.querySelector('.mobile-app')!.classList.toggle('solo',count===1);
  if(adventure){
    adventure.exitController?.reset();
    adventure.playing=false;
    adventure.awaitingReady=false;
    adventure.paused=false;
    adventure.anims.paused=false;
    adventure.clearDuck();
    adventure.setDifficulty(difficulty);
  }
  journey.reset();
  stellaClicks = 0;
  showScreen('character-select');
  renderSelection();
}
document.querySelector('#play-menu')!.addEventListener('click',()=>openDifficultySelect(2));
document.querySelector('#solo-menu')!.addEventListener('click',()=>openDifficultySelect(1));
document.querySelectorAll('.back-home').forEach(el=>el.addEventListener('click',()=>showScreen('home')));
document.querySelector('#vibration')!.addEventListener('click',()=>{vibration=!vibration;saveSetting('vibration',String(vibration));updateVibrationUI();});
updateVibrationUI();
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
interface Runner { duckInputs: Set<string>; ducking: boolean; y: number; velocity: number; jumps: number; sprite: Phaser.GameObjects.Sprite; pet: Pet; magic: ElementMagic; isGhost?: boolean; ghostGlow?: Phaser.FX.Glow }
interface Item { variant: number; defeatedAt?: number; cue?: TutorialCue; cueView?: Phaser.GameObjects.Container; x: number; kind: Spawn['kind']; row: number; passed: boolean; icon: Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Container; obstacle: ObstacleType; width: number }
class Adventure extends Phaser.Scene {
  get world() { return worldOrder(this.seed)[this.level]; }
  level=0; players: Player[]=[newPlayer(),newPlayer()]; runners: Runner[]=[]; items: Item[]=[];
  shots: { x:number; distance:number; row:number; icon:Phaser.GameObjects.Image }[]=[];
  readyAt:number[]=[];
  difficulty: DifficultyKey = 'medium';
  setDifficulty(d: DifficultyKey) { this.difficulty = d; }
  get difficultyConfig(): DifficultyConfig { return DIFFICULTIES[this.difficulty] ?? DIFFICULTIES.medium; }
  background?: WorldBackground; orientationPaused=false; awaitingReady=false; readyCountdown=0; idleTime=0;
  accumulator=0; elapsed=0; next=0; plan: (Spawn & {row:number})[]=[]; playing=false; paused=false; started=false; seed=Date.now();
  exitController?: ExitConfirmationController;
  preload() {
    for (const world of [3,4]) {
      this.load.image(`bonus-${world}`, `assets/bonuses/world-${world}.png`);
      for (let v=0;v<3;v++) this.load.image(`ground-${world}-${v}`, `assets/obstacles/world-${world}-${v}.png`);
    }
    for(const enemy of [...new Map(ENEMIES.flat().map(enemy=>[enemy.key,enemy])).values()])this.load.spritesheet(`enemy-${enemy.key}`,`assets/enemies/${enemy.key}.png`,{frameWidth:192,frameHeight:192});
    this.load.image('level-1-floor', 'art/level-1-floor.png');
    for (let level = 0; level < WORLDS.length; level++) this.load.image(`panorama-${level}`, `art/level-${level + 1}-bg.png`);
    for (const hero of CHARACTERS) { const atlas=hero.clean?'atlas-elemental':'atlas';this.load.atlas(hero.key,`assets/characters/${hero.key}/${atlas}.png`,`assets/characters/${hero.key}/${atlas}.json`); }
    for(const key of ['eagle','fox','eagle-rest','eagle-fly','fox-rest','fox-run','black-cat-rest','ginger-cat-rest','air-cat','earth-cat','falcon','falcon-rest','falcon-fly','red-panda','red-panda-rest','red-panda-run'])this.load.image(key,`assets/pets/${key}.png`);
    for (const key of ['black-cat','ginger-cat']) this.load.spritesheet(key,`assets/pets/${key}.png`,{frameWidth:128,frameHeight:128});
    for (const key of ['rock','stakes','log','lantern','banner']) this.load.image(key,`assets/obstacles/${key}.png`);
    for (let lvl = 0; lvl < WORLDS.length; lvl++) {
      for (let v = 0; v < 4; v++) {
        this.load.image(`overhead-${lvl}-${v}`, `assets/obstacles/overhead/level-${lvl}-variant-${v}.png`);
      }
    }
  }
  create() {
    for(const enemy of [...new Map(ENEMIES.flat().map(enemy=>[enemy.key,enemy])).values()])this.anims.create({key:`enemy-${enemy.key}`,frames:this.anims.generateFrameNumbers(`enemy-${enemy.key}`,{start:0,end:3}),frameRate:6,repeat:-1});
    for(const hero of CHARACTERS){
      const texture=this.textures.createCanvas(`spell-${hero.key}`,64,48)!;
      drawSpell(texture.context,32,24,hero.key,0);texture.refresh();
    }
    document.querySelectorAll<HTMLElement>('.player-controls').forEach((controls,row)=>{
      const button=document.createElement('button');button.className='cast-control';button.dataset.cast=String(row);
      button.innerHTML=`<span>✦</span><strong>Заклинание</strong><small>Готово</small><kbd>${row===0?'D':'→'}</kbd>`;
      button.addEventListener('pointerdown',e=>{e.preventDefault();this.cast(row);});controls.append(button);
    });
    for (const hero of CHARACTERS) {
      const flipCount = (hero.key === 'kai' || hero.key === 'leya') ? 6 : 4;
      for (const [action,count,rate,repeat] of [['run',hero.run,12,-1],['hit',2,5,0],['idle',['sofia','stella','air','earth'].includes(hero.key)?1:hero.idle,3,-1],['duck',hero.duck,8,0],['flip',flipCount,8,0]] as const) {
        this.anims.create({key:`${hero.key}-${action}`,frames:Array.from({length:count},(_,i)=>({key:hero.key,frame:`${action}-${String(i).padStart(2,'0')}`})),frameRate:rate,repeat});
      }
    }
    for (const key of ['black-cat','ginger-cat']) {
      this.anims.create({key:`${key}-run`,frames:this.anims.generateFrameNumbers(key,{start:0,end:3}),frameRate:10,repeat:-1});
    }
    this.drawWorld();
    adventure=this;this.scene.setVisible(false);renderSelection();
    document.querySelector('#result-menu')!.addEventListener('click',()=>{showScreen('home');});
    this.exitController = new ExitConfirmationController({
      onPauseGame: () => {
        this.paused = true;
        this.clearDuck();
        this.anims.paused = true;
      },
      onResumeGame: () => {
        this.paused = false;
        this.anims.paused = false;
      },
      onExitConfirmed: () => {
        this.goHome();
      },
      onVisibilityChange: (visible) => {
        const dialog = document.querySelector<HTMLElement>('#confirm-exit-dialog');
        if (dialog) dialog.hidden = !visible;
        if (visible) {
          document.querySelector<HTMLButtonElement>('#confirm-exit-cancel')?.focus();
        }
      },
    });
    const goHome=()=>this.goHome();
    document.querySelector('#home-button')!.addEventListener('click',()=>this.exitController?.requestExit(this.playing,this.paused));
    document.querySelector('#rotate-home')!.addEventListener('click',goHome);
    document.querySelector('#confirm-exit-cancel')!.addEventListener('click',()=>this.exitController?.cancel());
    document.querySelector('#confirm-exit-backdrop')!.addEventListener('click',()=>this.exitController?.cancel());
    document.querySelector('#confirm-exit-yes')!.addEventListener('click',()=>this.exitController?.confirm());
    this.input.keyboard?.on('keydown', (event: KeyboardEvent)=> {
      if(document.querySelector<HTMLElement>('#play-screen')!.hidden)return;
      if (['ArrowUp','ArrowDown','ArrowRight','Space'].includes(event.code)) event.preventDefault();
      if(event.repeat)return;
      if(event.code==='Escape'){
        if(this.exitController?.isOpen){
          event.preventDefault();
          this.exitController.cancel();
          return;
        }
        if(this.playing)this.togglePause();
        return;
      }
      if(this.exitController?.isOpen)return;
      if(event.code==='KeyD')this.cast(0);
      if(event.code==='ArrowRight')this.cast(journey.count===1?0:1);
      if(event.code==='KeyW')this.jump(0);
      if(event.code==='ArrowUp')this.jump(journey.count===1?0:1);
      if(event.code==='KeyS')this.duck(0,'keyboard',true);
      if(event.code==='ArrowDown')this.duck(journey.count===1?0:1,'keyboard',true);
    });
    this.input.keyboard?.on('keyup',(event: KeyboardEvent)=>{
      if(event.code==='KeyS')this.duck(0,'keyboard',false);
      if(event.code==='ArrowDown')this.duck(journey.count===1?0:1,'keyboard',false);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach(button=>button.addEventListener('pointerdown',e=>{ e.preventDefault();this.jump(Number(button.dataset.jump)); }));
    document.querySelectorAll<HTMLButtonElement>('[data-duck]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.duck(Number(button.dataset.duck),`pointer-${e.pointerId}`,true);});
      const release=(e:PointerEvent)=>this.duck(Number(button.dataset.duck),`pointer-${e.pointerId}`,false);
      button.addEventListener('pointerup',release);
      button.addEventListener('pointercancel',release);
      button.addEventListener('lostpointercapture',release);
    });
    document.querySelector('#pause')!.addEventListener('click',()=>this.togglePause());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing&&!this.paused)this.togglePause();});
    window.addEventListener('blur',()=>{if(this.playing&&!this.paused)this.togglePause();});
    new ResizeObserver(()=>this.resizeArena()).observe(document.querySelector('#game')!);
    window.matchMedia('(orientation: portrait)').addEventListener('change',()=>this.checkOrientation());
  }
  goHome(){this.exitController?.reset();if(this.playing&&!this.paused)this.togglePause();this.orientationPaused=false;showScreen('home');}
  ground(row:number){return this.scale.height*((row+ .92)/journey.count);}
  checkOrientation(){
    if(!this.playing||document.querySelector<HTMLElement>('#play-screen')!.hidden)return;
    if(window.matchMedia('(orientation: portrait)').matches){
      if(!this.paused){this.togglePause();this.orientationPaused=true;}
    }else if(this.orientationPaused){this.orientationPaused=false;if(this.paused)this.togglePause();}
  }
  resizeArena(){
    const bounds=document.querySelector('#game')!.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    this.scale.resize(1100,1100*bounds.height/bounds.width);
    this.background?.resize();
    this.runners.forEach((r,row)=>{r.pet.sprite.y+=this.ground(row)+r.y-r.sprite.y;r.sprite.y=this.ground(row)+r.y;});
    this.items.forEach(item=>{
      const bonusY=item.kind==='bonus'?(item.obstacle==='overhead'?32:item.obstacle==='none'?170:112):0;
      item.icon.y=this.ground(item.row)-bonusY;
      this.updateCue(item);
    });
    this.checkOrientation();
  }
  drawWorld() {
    this.children.removeAll(true);this.items=[];this.runners=[];this.shots=[];this.readyAt=[];this.idleTime=0;
    this.background = new WorldBackground(this, this.world, journey.count, this.difficultyConfig.speedMultiplier);
    for(let row=0;row<journey.count;row++) {
      const floor=this.ground(row);
      const hero=heroFor(row);
      const sprite=this.add.sprite(160,floor,hero.key,'idle-00').setOrigin(.5,240/256).setScale(hero.scale).play(`${hero.key}-idle`);
      const pet=new Pet(this,row,floor,hero.pet);
      const magic=new ElementMagic(this,hero.key);
      this.runners.push({duckInputs:new Set(),ducking:false,y:0,velocity:0,jumps:0,sprite,pet,magic});
    }
  }
  prepareLevel(reset=false) {
    this.exitController?.reset();
    const cfg = this.difficultyConfig;
    if(reset){this.level=0;this.players=journey.selected.map(()=>newPlayer(0, cfg.lives));this.seed=attempt?.seed??Date.now();}
    else this.players=this.players.map(p=>newPlayer(p.score, cfg.lives));
    this.playing=false;this.paused=false;this.awaitingReady=true;this.readyCountdown=0;this.started=true;this.anims.paused=false;journey.resetReady();
    logs[this.level]=[];this.elapsed=0;this.accumulator=0;this.next=0;
    this.plan=journey.selected.flatMap((_,row)=>route(this.seed+this.level,row,this.difficulty).map(s=>({...s,row}))).sort((a,b)=>a.at-b.at);
    this.resizeArena();this.drawWorld();this.hud();this.updateHeroLabels();
    (document.querySelector('#pause') as HTMLButtonElement).disabled=true;
    document.querySelector('#world-title')!.textContent=`УРОВЕНЬ ${this.level+1} · ${WORLDS[this.world].name} · ${cfg.name}`;
    const intro=document.querySelector<HTMLElement>('#level-intro')!;
    intro.hidden=false;intro.classList.remove('is-starting');
    intro.style.setProperty('--location-accent',WORLDS[this.world].accent);
    intro.querySelector('h2')!.textContent=WORLDS[this.world].name;
    intro.querySelector('.location-subtitle')!.textContent=WORLDS[this.world].subtitle;
    intro.querySelector('.start-countdown')!.textContent='';
    this.renderReady();
    document.querySelector('#selection-hint')!.textContent=attempt
      ? `Сложность «${cfg.name}» · Результат можно записать в общий рейтинг`
      : `Автономная игра · Сложность «${cfg.name}»`;
  }
  updateHeroLabels(){
    journey.selected.forEach((_,row)=>{
      const hero=heroFor(row),controls=document.querySelectorAll<HTMLElement>('.player-controls')[row],label=document.querySelectorAll<HTMLElement>('.lane-label')[row];
      controls.style.setProperty('--hero-color',hero.color);controls.dataset.hero=hero.key;
      controls.querySelector('.cast-control')!.setAttribute('aria-label',SPELLS[hero.key].name);
      controls.querySelector('.cast-control span')!.textContent=hero.symbol;
      controls.querySelector('.jump strong')!.textContent=hero.name;controls.querySelector('.jump-element')!.textContent=hero.symbol;
      controls.querySelector('.jump')!.setAttribute('aria-label',`Прыжок игрока ${row+1}, ${hero.name}`);
      controls.querySelector('.duck-control')!.setAttribute('aria-label',`Присед игрока ${row+1}, ${hero.name}`);
      label.querySelector('strong')!.textContent=`Игрок ${row+1} · ${hero.name}`;label.querySelector('.avatar')!.textContent=hero.symbol;
    });
  }
  renderReady(){
    overlay.hidden=false;overlay.classList.add('ready-overlay');
    overlay.innerHTML=journey.selected.map((_,row)=>`<div class="ready-card ${journey.ready[row]?'is-ready':''}"><span class="eyebrow">ИГРОК ${row+1} · ${heroFor(row).name}</span><h2>${journey.ready[row]?'Готов!':'Готовы в путь?'}</h2><p>${journey.ready[row]?'Ждём напарника…':heroFor(row).companionReadyText+' Перепрыгни врага или используй заклинание — за победу +25.'}</p><button class="primary" data-ready="${row}" ${journey.ready[row]?'disabled':''}>${journey.ready[row]?'✓ Готов':`Я готов · ${row===0?'W / S':'↑ / ↓'}`}</button></div>`).join('');
    overlay.querySelectorAll<HTMLElement>('[data-ready]').forEach(button=>button.addEventListener('click',()=>this.markReady(Number(button.dataset.ready))));
    if(journey.ready.every(Boolean))overlay.querySelectorAll('p').forEach(p=>p.textContent='Вперёд, вместе!');
  }
  markReady(row:number){
    if(!this.awaitingReady||document.querySelector<HTMLElement>('#play-screen')!.hidden||this.readyCountdown>0)return;
    if(journey.markReady(row)){
      this.readyCountdown=4.6;
      document.querySelector('#level-intro')!.classList.add('is-starting');
    }
    this.renderReady();if(this.readyCountdown>0)overlay.hidden=true;beep(row===0?470:560);
  }
  begin() {
    document.querySelector<HTMLElement>('#level-intro')!.hidden=true;
    this.awaitingReady=false;this.readyCountdown=0;this.playing=true;this.paused=false;this.anims.paused=false;overlay.hidden=true;overlay.classList.remove('ready-overlay');
    this.runners.forEach((r,row)=>r.sprite.setScale(heroFor(row).scale));
    (document.querySelector('#pause') as HTMLButtonElement).disabled=false;document.querySelector('#pause')!.textContent='Ⅱ';
    this.orientationPaused=false;this.checkOrientation();
  }
  jump(row:number){if(this.exitController?.isOpen)return;if(this.awaitingReady){this.markReady(row);return;}const r=this.runners[row];if(!this.playing||this.paused||r.duckInputs.size>0)return;const res=jumpVelocity(r.y,r.jumps);if(!res)return;r.velocity=res.velocity;r.jumps=res.jumps;consumeCue(this.items,row,res.isDouble?'double':'jump',WORLDS[this.world].speed*this.difficultyConfig.speedMultiplier,this.elapsed);logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'jump',pressed:true});if(res.isDouble)r.magic.burst(r.y);if(vibration)navigator.vibrate?.(15);beep(res.isDouble?(row===0?590:700):(row===0?470:560));}
  duck(row:number,source:string,pressed:boolean){
    if(this.exitController?.isOpen)return;
    const r=this.runners[row];if(!r)return;
    if(!pressed){const was=r.duckInputs.size>0;r.duckInputs.delete(source);if(was&&!r.duckInputs.size&&this.playing)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:false});return;}
    if(this.awaitingReady){this.markReady(row);return;}
    if(!this.playing||this.paused)return;
    if(!r.duckInputs.size)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:true});r.duckInputs.add(source);
  }
  cast(row:number){
    if(!this.runners[row]||!this.playing||this.paused||this.exitController?.isOpen||this.elapsed<(this.readyAt[row]??0))return;
    this.readyAt[row]=this.elapsed+SPELL_COOLDOWN_MS;
    this.shots.push({x:160,distance:0,row,icon:this.add.image(160,this.ground(row)-30,`spell-${heroFor(row).key}`).setDepth(5)});
    logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'cast',pressed:true});beep(680);
  }
  clearDuck(){this.runners.forEach((r,row)=>{if(r.duckInputs.size&&this.playing)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:false});r.duckInputs.clear();r.ducking=false;});}
  togglePause(){if(this.exitController?.isOpen)this.exitController.cancel();if(!this.playing)return;this.paused=!this.paused;this.clearDuck();this.anims.paused=this.paused;document.querySelector('#pause')!.textContent=this.paused?'▶':'Ⅱ';overlay.hidden=!this.paused;if(this.paused){overlay.innerHTML='<div class="intro-mark">Ⅱ</div><h2>Маленькая передышка</h2><p>Ваше приключение подождёт.</p><button id="resume" class="primary">Продолжить →</button><button id="pause-home" class="secondary">В главное меню</button>';document.querySelector('#resume')!.addEventListener('click',()=>this.togglePause());document.querySelector('#pause-home')!.addEventListener('click',()=>this.goHome());}}
  spawn(s:Spawn & {row:number}){const row=s.row;{
    const bonus=s.kind==='bonus', x=1150, obstacle=s.obstacle??'ground';
    let icon: Item['icon'];
    if(s.kind==='enemy'){
      const key=`enemy-${ENEMIES[this.world][s.variant%2].key}`;
      icon=this.add.container(x,this.ground(row),[this.add.sprite(0,0,key).setOrigin(.5,1).setScale(.46).play(key)]);
    }else if(bonus){
      const bonusY=obstacle==='overhead'?32:obstacle==='none'?170:112;
      const text=this.world>=3 ? this.add.image(0,0,`bonus-${this.world}`).setDisplaySize(36,36).setOrigin(.5,1) : this.add.text(0,0,WORLDS[this.world].bonus,{fontSize:'27px',fontFamily:'Arial'}).setOrigin(.5,1);
      icon=this.add.container(x,this.ground(row)-bonusY,[text]);
    }else if(obstacle==='overhead'){
      const v = Math.abs(Math.floor(s.at / 1900)) % 4;
      const key = `overhead-${this.world}-${v}`;
      let log: Phaser.GameObjects.Image;
      if (this.textures.exists(key)) {
        log = this.add.image(0, 0, key).setOrigin(0.5, 155 / 160);
      } else {
        const fallbackKey = `arch-${this.world}`;
        if (!this.textures.exists(fallbackKey)) {
          const texture = this.textures.createCanvas(fallbackKey, 140, 160)!;
          drawArch(texture.context, 65, 155, this.world);
          texture.refresh();
        }
        log = this.add.image(0, 0, fallbackKey).setOrigin(65 / 140, 155 / 160);
      }
      icon=this.add.container(x,this.ground(row),[log]);
      if(this.world===3){const key='swamp-beam';if(!this.textures.exists(key)){const texture=this.textures.createCanvas(key,200,160)!;drawArch(texture.context,100,155,this.world);texture.refresh();}(icon as Phaser.GameObjects.Container).add(this.add.image(0,0,key).setOrigin(.5,155/160));}
    }else {
      const obstacleImage=this.add.image(0,0,this.world>=3 ? `ground-${this.world}-${s.variant%3}` : ['rock','stakes','log'][s.variant]).setOrigin(.5,176/192).setScale(.46);
      icon=this.add.container(x,this.ground(row),[obstacleImage]);
    }
    const item: Item={variant:s.variant,x,kind:s.kind,row,passed:false,icon,obstacle,width:bonus?24:32};
    if(this.level===0&&s.kind!=='enemy'&&(!bonus||obstacle==='none')){
      const action=bonus?'double':obstacle==='overhead'?'duck':'jump';
      item.cue={row,action,offset:cueOffset(action,WORLDS[this.world].speed*this.difficultyConfig.speedMultiplier)};
      const hero=heroFor(row);
      const arrow=this.add.text(0,0,action==='double'?'⇈':action==='duck'?'↓':'↑',{
        fontFamily:'Arial',fontSize:'48px',fontStyle:'bold',color:hero.color,
        stroke:'#28404b',strokeThickness:2,
        shadow:{offsetX:0,offsetY:0,color:hero.color,blur:12,fill:true,stroke:true}
      }).setOrigin(.5);
      const detail=this.add.text(24,7,['≈','♨','彡','◇','ϟ','❧'][journey.selected[row]],{fontSize:'23px',color:hero.color}).setOrigin(.5);
      item.cueView=this.add.container(0,0,[arrow,detail]).setName('helper-cue').setDepth(20);
      this.updateCue(item);
    }
    this.items.push(item);
  }}
  updateCue(item: Item){
    if(!item.cue||!item.cueView)return;
    const frame=cueFrame(item.cue,item.x,WORLDS[this.world].speed*this.difficultyConfig.speedMultiplier,this.elapsed);
    const height=item.cue.action==='double'?198:item.cue.action==='duck'?145:83;
    item.cueView.setPosition(frame.x,this.ground(item.row)-Math.min(height,this.scale.height/journey.count*.92-34)+frame.bob).setAlpha(frame.alpha);
  }
  hud(){
    const cfg = this.difficultyConfig;
    this.players.forEach((p,i)=>{
      document.querySelector(`#lives-${i}`)!.textContent=p.lives===0?'👻 Призрак':'♥ '.repeat(p.lives)+'♡ '.repeat(cfg.lives-p.lives);
      document.querySelector(`#score-${i}`)!.innerHTML=`${p.score} <small>очков</small>`;
    });
    const seconds=Math.ceil(Math.max(0,cfg.levelSeconds-this.elapsed/1000));
    document.querySelector('#timer')!.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  finish(){
    this.exitController?.reset();
    this.playing=false;this.awaitingReady=false;this.clearDuck();this.runners.forEach(r=>{r.sprite.stop();r.pet.stop();r.magic.clear();});
    (document.querySelector('#pause') as HTMLButtonElement).disabled=true;
    const cfg = this.difficultyConfig;
    const lost=this.players.every(p=>p.lives===0),last=this.level===WORLDS.length-1;
    const result=document.querySelector<HTMLElement>('#result')!;result.classList.toggle('is-defeat',lost);
    document.querySelector('#result-eyebrow')!.textContent=lost
      ? `ПОПЫТКА НЕ УДАЛАСЬ · СЛОЖНОСТЬ «${cfg.name.toUpperCase()}»`
      : last
        ? `ТРИУМФ СТИХИЙ · СЛОЖНОСТЬ «${cfg.name.toUpperCase()}»`
        : `УРОВЕНЬ ${this.level+1} ПРОЙДЕН · ${cfg.name.toUpperCase()}`;
    document.querySelector('#result-title')!.textContent=lost?'Ещё одна попытка?':last?'Равновесие восстановлено!':'Уровень пройден!';
    document.querySelector('#result-description')!.textContent=lost?'Отдохните вместе с котиками и попробуйте снова.':last?'Все пять миров позади. Ваша команда справилась!':'Ваша команда и верные котики готовы идти дальше.';
    document.querySelector('#result-party')!.innerHTML=journey.selected.map(i=>`<div>${portraitMarkup(CHARACTERS[i])}${petMarkup(CHARACTERS[i])}</div>`).join('');
    document.querySelector('#result-scores')!.innerHTML=this.players.map((p,i)=>`<div><strong>${heroFor(i).name}</strong><b>${p.score}</b><small>очков · ${p.lives} ♥</small></div>`).join('');
    const next=document.querySelector<HTMLButtonElement>('#result-next')!;next.textContent=lost?'Попробовать снова':last?'Новое путешествие':'Следующий уровень →';
    const rankingTarget = document.querySelector<HTMLElement>('#result-ranking')!;
    rankingTarget.replaceChildren();

    const proceedNext = () => {
      if(last&&!lost){
        showScreen('difficulty-select');
        return;
      }
      if(!lost)this.level++;
      showScreen('play-screen');
      if(lost){
        const totals=this.players.map(p=>Math.max(0,p.score-p.roundScore));
        this.players=totals.map(score=>newPlayer(score, cfg.lives));
      }
      this.prepareLevel();
    };

    if (lost || last) {
      const flowPlayers = this.players.map((p, i) => ({
        heroIndex: journey.selected[i],
        heroName: heroFor(i).name,
        score: p.score,
        lives: p.lives,
      }));
      const attemptId = attempt?.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const attemptToken = attempt?.token;
      const flow = new RankingFlowController(flowPlayers, this.difficulty, attemptId, attemptToken);

      if (attempt && last && !lost) {
        const currentAttempt = attempt;
        void api(`attempts/${currentAttempt.id}/finish`, {
          token: currentAttempt.token,
          heroes: journey.selected,
          logs,
        }).catch(() => {});
      }

      const renderRankingStep = () => {
        rankingTarget.replaceChildren();
        if (flow.isComplete) {
          const note = document.createElement('div');
          note.className = 'ranking-summary-note';
          note.innerHTML = '<span class="summary-check" aria-hidden="true">✓</span> <span>Сохранение рейтинга завершено</span>';
          rankingTarget.append(note);
          return;
        }

        const current = flow.currentPlayer!;
        const card = document.createElement('div');
        card.className = 'ranking-flow-card';

        const header = document.createElement('div');
        header.className = 'ranking-flow-header';
        const stepLabel = flow.totalPlayers > 1
          ? `Игрок ${current.index + 1} из ${flow.totalPlayers} · ${current.heroName}`
          : `Игрок 1 · ${current.heroName}`;
        const crown = current.isWinner ? ' <span class="winner-crown" title="Лучший результат">👑 Победитель</span>' : '';
        header.innerHTML = `
          <span class="ranking-flow-step">${stepLabel}${crown}</span>
          <strong class="ranking-flow-score">${current.score} <small>очков</small></strong>
        `;

        const form = document.createElement('form');
        form.className = 'ranking-flow-form';

        const input = document.createElement('input');
        input.type = 'text';
        input.required = true;
        input.maxLength = 20;
        input.placeholder = `Имя игрока ${current.index + 1}`;
        input.setAttribute('autocomplete', 'nickname');
        input.setAttribute('aria-label', `Имя игрока ${current.index + 1}`);

        const actions = document.createElement('div');
        actions.className = 'ranking-flow-actions';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'primary';
        submitBtn.textContent = 'Записать в рейтинг';

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'secondary btn-skip-rating';
        skipBtn.textContent = 'Пропустить';

        const status = document.createElement('p');
        status.className = 'ranking-flow-status';
        status.setAttribute('role', 'status');

        actions.append(submitBtn, skipBtn);
        form.append(input, actions, status);
        card.append(header, form);
        rankingTarget.append(card);

        setTimeout(() => input.focus(), 60);

        skipBtn.onclick = () => {
          flow.requestSkip();
          openSkipConfirm(
            `Результат Игрока ${current.index + 1} (${current.heroName}, ${current.score} очков) не будет сохранён в рейтинге.`,
            () => {
              flow.confirmSkip();
              renderRankingStep();
            },
            () => {
              flow.cancelSkip();
              input.focus();
            }
          );
        };

        form.onsubmit = async (e) => {
          e.preventDefault();
          const name = input.value.trim();
          if (!name) return;
          submitBtn.disabled = true;
          skipBtn.disabled = true;
          input.disabled = true;
          status.textContent = 'Сохраняем…';
          try {
            const res = await flow.saveCurrentPlayer(name, api);
            if (res.offline) {
              status.textContent = '✓ Сохранено локально! Будет отправлено при появлении связи.';
            } else {
              status.textContent = '✓ Результат записан в рейтинг!';
            }
            setTimeout(renderRankingStep, 600);
          } catch (err) {
            status.textContent = String(err);
            submitBtn.disabled = false;
            skipBtn.disabled = false;
            input.disabled = false;
          }
        };
      };
      renderRankingStep();

      next.onclick = proceedNext;
      const resultMenu = document.querySelector<HTMLButtonElement>('#result-menu')!;
      resultMenu.onclick = () => showScreen('home');
    } else {
      next.onclick = proceedNext;
    }
    showScreen('result');
  }
  update(_time:number,delta:number){
    if(document.querySelector<HTMLElement>('#play-screen')!.hidden)return;
    const dt=Math.min(delta,40)/1000;
    if(this.awaitingReady){
      this.idleTime+=dt;
      this.runners.forEach((r,row)=>{
        const hero=heroFor(row);
        if(['sofia','stella','air','earth'].includes(hero.key)){
          // A continuous breath keeps the feet planted and avoids abrupt pose changes.
          const breath=(1-Math.cos(this.idleTime*2+row*.8))*.5;
          r.sprite.setScale(hero.scale*(1-breath*.004),hero.scale*(1+breath*.018));
        }else{
          r.sprite.setScale(hero.scale*(1+Math.sin(this.idleTime*2+row)*.012),hero.scale);
        }
        r.pet.idle(dt,this.ground(row));
      });
      if(this.readyCountdown>0&&!window.matchMedia('(orientation: portrait)').matches){this.readyCountdown=Math.max(0,this.readyCountdown-dt);
        const label=this.readyCountdown>4?'':this.readyCountdown>3?'3':this.readyCountdown>2?'2':this.readyCountdown>1?'1':'Вперёд, маги!';
        const countdown=document.querySelector<HTMLElement>('.start-countdown')!;
        if(countdown.textContent!==label){
          countdown.textContent=label;countdown.classList.toggle('is-go',label==='Вперёд, маги!');
          countdown.getAnimations().forEach(animation=>animation.cancel());
          if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)countdown.animate([{opacity:0,transform:'scale(.7)'},{opacity:1,transform:'scale(1)'}],{duration:280,easing:'ease-out'});
          if(label)beep(label==='Вперёд, маги!'?880:660);
        }
        if(this.readyCountdown<=0)this.begin();}
      return;
    }
    if(!this.playing||this.paused)return;this.accumulator+=Math.min(delta,100);while(this.accumulator>=20&&this.playing){this.accumulator-=20;this.step();}
  }
  step(){
    const cfg=this.difficultyConfig;
    const currentSpeed=WORLDS[this.world].speed*cfg.speedMultiplier;
    const dt=.02;this.elapsed+=20;this.background?.update(dt,this.elapsed);
    while(this.next<this.plan.length&&this.plan[this.next].at<=this.elapsed)this.spawn(this.plan[this.next++]);
    this.runners.forEach((r,i)=>{r.velocity+=GRAVITY*dt;r.y=Math.min(0,r.y+r.velocity*dt);if(r.y===0){r.velocity=0;r.jumps=0;}const wasDucking=r.ducking;r.ducking=r.y===0&&r.duckInputs.size>0;if(r.ducking&&!wasDucking)consumeCue(this.items,i,'duck',currentSpeed,this.elapsed);const hero=heroFor(i).key;
      r.sprite.anims.timeScale=1;
      if(this.elapsed < this.players[i].invulnerable && this.elapsed > this.players[i].invulnerable-650) {
        r.sprite.stop();r.sprite.setFrame(this.elapsed<this.players[i].invulnerable-450?'hit-00':'hit-01');
      } else if(r.y<0){
        if(r.jumps>=2){
          r.sprite.play(`${hero}-flip`,true);
        }else{
          r.sprite.stop();r.sprite.setFrame(r.velocity< -150?'jump-00':r.velocity<150?'jump-01':'jump-02');
        }
      }
      else if(r.ducking){
        if(r.sprite.anims.currentAnim?.key!==`${hero}-duck`||!String(r.sprite.frame.name).startsWith('duck-'))r.sprite.play(`${hero}-duck`);
      } else {r.sprite.anims.timeScale=currentSpeed/270;r.sprite.play(`${hero}-run`,true);}
      r.sprite.y=this.ground(i)+r.y;
      const hurt=String(r.sprite.frame.name).startsWith('hit-');
      r.magic.update(dt,r.sprite.x,r.sprite.y,this.ground(i),hurt?'none':r.y<0?'jump':r.ducking?'duck':'none',currentSpeed,r.sprite);
      r.pet.update(dt,this.ground(i),r.y,r.ducking);
      const isGhost=this.players[i].lives===0;
      if(isGhost!==r.isGhost){
        r.isGhost=isGhost;
        if(isGhost){
          r.sprite.setTint(0x00ffff);
          if(r.sprite.postFX&&!r.ghostGlow)r.ghostGlow=r.sprite.postFX.addGlow(0x00ffff,4,1.2,false,0.1,10);
        }else{
          r.sprite.clearTint();
          if(r.ghostGlow){r.sprite.postFX?.remove(r.ghostGlow);r.ghostGlow=undefined;}
        }
      }
      r.sprite.alpha=isGhost?.68:this.elapsed<this.players[i].invulnerable?(Math.floor(this.elapsed/100)%2?.4:1):1;});
    for(const shot of this.shots){
      const from=shot.x,travel=Math.min(SPELL_SPEED*dt,SPELL_RANGE-shot.distance);
      shot.x+=travel;shot.distance+=travel;
      const candidates=this.items.filter(i=>i.kind==='enemy'&&!i.passed).map(item=>({x:item.x-currentSpeed*dt,row:item.row,defeated:false,item}));
      const target=firstSpellTarget(candidates,shot.row,from-currentSpeed*dt,shot.x);
      if(target){target.item.passed=true;target.item.defeatedAt=this.elapsed;award(this.players[shot.row],ENEMY_REWARD);shot.distance=SPELL_RANGE;beep(900);}
      shot.icon.setPosition(shot.x,this.ground(shot.row)-30);
    }
    this.shots=this.shots.filter(shot=>{if(shot.distance>=SPELL_RANGE){shot.icon.destroy();return false;}return true;});
    document.querySelectorAll<HTMLButtonElement>('[data-cast]').forEach(button=>{
      const row=Number(button.dataset.cast),left=Math.max(0,(this.readyAt[row]??0)-this.elapsed);
      button.disabled=left>0;button.style.setProperty('--charge',`${(1-left/SPELL_COOLDOWN_MS)*100}%`);
      button.querySelector('small')!.textContent=left>0?`${(left/1000).toFixed(1)} с`:'Готово';
    });
    for(const item of this.items){
      if(item.kind==='enemy'&&item.defeatedAt===undefined){const sprite=(item.icon as Phaser.GameObjects.Container).first as Phaser.GameObjects.Sprite;sprite.stop().setFrame(Math.floor(this.elapsed/160)%4);}
      if(item.defeatedAt!==undefined){const progress=Math.min(1,(this.elapsed-item.defeatedAt)/ENEMY_FALL_MS);item.icon.setAngle(-90*progress).setAlpha(1-progress);}
      item.x-=currentSpeed*dt;item.icon.x=item.x;this.updateCue(item);const p=this.players[item.row],r=this.runners[item.row];
      if(!item.passed&&Math.abs(item.x-160)<(item.kind==='bonus'?30:28)){if((item.kind==='obstacle'||item.kind==='enemy')&&obstacleCollision(r.y,r.ducking,item.obstacle)){item.passed=true;if(hit(p,this.elapsed))beep(150);}else if(item.kind==='bonus'&&(item.obstacle==='overhead'?r.ducking&&r.y===0:item.obstacle==='none'?r.y<-130&&r.y>-230:r.y<-35&&r.y>-146)){award(p,25);item.passed=true;item.icon.setVisible(false);beep(850);}}
      if(!item.passed&&item.x<120){if(item.kind==='obstacle')award(p,10);item.passed=true;}
    }
    this.items=this.items.filter(item=>{if(item.x<-50){item.icon.destroy();item.cueView?.destroy();return false;}return true;});this.hud();if(this.elapsed>=cfg.levelSeconds*1000||this.players.every(p=>p.lives===0))this.finish();
  }
}
export const game = new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1100,height:530,backgroundColor:'#f8dfea',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Adventure,render:{antialias:true},input:{activePointers:3}});
function updateSoundUI(){const el=document.querySelector('#sound-state');if(el){el.textContent=sound?'Вкл.':'Выкл.';el.classList.toggle('is-on',sound);}}
document.querySelector('#sound')?.addEventListener('click',()=>{sound=!sound;saveSetting('sound',String(sound));updateSoundUI();if(sound)beep(660);});
updateSoundUI();
initPWA();

const network=mountNetwork(showScreen);
document.querySelector('#online-menu')!.addEventListener('click',()=>{
  if(typeof navigator !== 'undefined' && !navigator.onLine){
    showToast('Онлайн-режим недоступен без интернета');
    return;
  }
  adventure?.goHome();
  network.open();
});
document.querySelector('#ranking-menu')!.addEventListener('click',()=>network.ranking());
try{if((new URLSearchParams(location.search).has('room')||sessionStorage.getItem('jump-room'))&&(typeof navigator==='undefined'||navigator.onLine))network.open();}catch{}
