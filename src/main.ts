import Phaser from 'phaser';
import { api, mountNetwork, nameForms, drawArch, type Action, type Attempt } from './network';
import './style.css';
import { CHARACTERS, portraitMarkup, petMarkup } from './characters';
import { Journey } from './journey';
import { Pet } from './pets';
import { ElementMagic } from './element-magic';
import { WorldBackground } from './backgrounds';
import { obstacleCollision, award, GRAVITY, hit, JUMP_VELOCITY, LEVEL_SECONDS, newPlayer, route, WORLDS, type ObstacleType, type Player, type Spawn } from './rules';
import { initPWA } from './pwa';

const journey = new Journey();
const heroFor = (row: number) => CHARACTERS[journey.selected[row]];
let adventure: Adventure | undefined;
let attempt: Attempt | undefined;
let logs: Action[][] = [[],[],[]];
let startingLocal=false;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<main class="mobile-app">
<section id="splash" class="screen splash" tabindex="0" role="button" aria-label="Нажмите любую кнопку или коснитесь экрана, чтобы открыть меню">
  <div class="splash-title"><span class="eyebrow">ЧЕТЫРЕ СТИХИИ · ДВА ИГРОКА</span><h1>Волшебный<br><em>Прыжок Онлайн</em></h1><p class="tagline">Два пути · Один мир</p></div>
  <div class="splash-bottom"><div class="screen-pets">${petMarkup(CHARACTERS[0])}${petMarkup(CHARACTERS[1])}</div><p class="press-any">Нажмите любую кнопку</p><small>или коснитесь экрана</small></div>
</section>
<section id="home" class="home screen" hidden>
  <div class="home-content">
    <div class="home-crest" aria-hidden="true">水</div>
    <h1>Волшебный<br><em>Прыжок Онлайн</em></h1>
    <p class="tagline">Два пути · Один мир</p><div class="ornament" aria-hidden="true">──── ◇ ────</div>
    <nav class="home-menu" aria-label="Главное меню">
      <button id="play-menu" class="menu-item menu-primary"><span class="menu-icon" aria-hidden="true">水</span><span>2 игрока</span></button>
      <button id="solo-menu" class="menu-item">1 игрок</button>
      <button id="online-menu" class="menu-item">Онлайн</button><button id="ranking-menu" class="menu-item">Рейтинг</button>
      <button id="continue" class="menu-item" disabled><span class="menu-icon" aria-hidden="true">♨</span><span>Продолжить</span></button>
      <button id="install-menu" class="menu-item" data-install-btn><span class="menu-icon" aria-hidden="true">⬇</span><span class="install-text">Скачать игру</span></button>
      <button id="settings-open" class="menu-item"><span class="menu-icon" aria-hidden="true">⚙</span><span>Настройки</span></button>
      <button id="exit-menu" class="menu-item"><span class="menu-icon" aria-hidden="true">⇥</span><span>Выход</span></button>
    </nav>
    <div class="screen-pets home-pets" id="home-pets">${petMarkup(CHARACTERS[0])}${petMarkup(CHARACTERS[1])}</div>
  </div>
</section>
<section id="farewell" class="screen farewell" hidden><span class="home-crest" aria-hidden="true">水</span><h2>До новых встреч</h2><p>София и Стелла будут ждать вас.</p><button class="secondary back-home">Вернуться в меню</button></section>
<section id="character-select" class="screen character-select" hidden>
  <header class="selection-header"><button id="selection-back" class="icon-button" aria-label="Назад">←</button><span class="eyebrow">СОБЕРИТЕ СВОЮ КОМАНДУ</span><span id="selection-step">01 / 02</span></header>
  <div class="selection-heading"><span class="eyebrow" id="choosing-player">ИГРОК 1</span><h2>Выберите персонажа</h2><p id="selection-hint">Ваш спутник-кот отправится вместе с вами.</p></div>
  <div class="character-grid" id="character-grid"></div>
  <footer class="selection-footer"><div id="party-preview" class="party-preview"></div><button id="confirm-character" class="primary">Подтвердить →</button></footer>
</section>
<section id="result" class="screen result-screen" hidden><div class="result-content"><span class="eyebrow" id="result-eyebrow"></span><h2 id="result-title"></h2><p id="result-description"></p><div id="result-party" class="result-party"></div><div id="result-scores" class="result-scores"></div><button id="result-next" class="primary"></button><button id="result-menu" class="secondary">В главное меню</button></div></section>
<section id="play-screen" class="screen play-screen" hidden>
<div class="player-controls sofia"><button class="jump sofia" data-jump="0" aria-label="Прыжок первого игрока, Софии"><span class="jump-element">水</span><small>ИГРОК 1</small><strong>София</strong><span class="jump-glyph">↟</span><span class="jump-action">Прыжок</span><kbd>W</kbd></button><button class="duck-control" data-duck="0" aria-label="Присед Софии"><span>↧</span><strong>Присед</strong><small>Удерживайте</small><kbd>S</kbd></button></div>
<div class="play-center"><div class="arena-wrap"><div id="game"></div>
<div class="lane-label top"><span class="avatar lavender">水</span><div><strong>Игрок 1 · София</strong><span id="lives-0">♥ ♥ ♥</span></div><b id="score-0">0 <small>очков</small></b></div>
<div class="lane-label bottom"><span class="avatar mint">火</span><div><strong>Игрок 2 · Стелла</strong><span id="lives-1">♥ ♥ ♥</span></div><b id="score-1">0 <small>очков</small></b></div>
<div class="arena-toolbar"><button id="home-button" class="icon-button" aria-label="В меню">⌂</button><span id="world-title">Конфетный мир</span><span class="timer" id="timer">01:00</span><button id="pause" class="icon-button" aria-label="Пауза" disabled>Ⅱ</button></div>
<div id="overlay" class="overlay" hidden></div></div></div>
<div class="player-controls stella"><button class="jump stella" data-jump="1" aria-label="Прыжок второго игрока, Стеллы"><span class="jump-element">火</span><small>ИГРОК 2</small><strong>Стелла</strong><span class="jump-glyph">↟</span><span class="jump-action">Прыжок</span><kbd>↑</kbd></button><button class="duck-control" data-duck="1" aria-label="Присед Стеллы"><span>↧</span><strong>Присед</strong><small>Удерживайте</small><kbd>↓</kbd></button></div>
<div class="rotate-notice"><span>⤾</span><h2>Поверните телефон</h2><p>Играйте горизонтально: София слева, Стелла справа.<br>Две дорожки — в центре экрана.</p><button id="rotate-home" class="secondary">Вернуться в меню</button></div>
</section>
<section id="settings" class="screen panel" hidden><div class="panel-top"><button class="icon-button back-home" aria-label="Назад">←</button><span>НАСТРОЙКИ</span><span>✦</span></div><div class="panel-heading"><span class="eyebrow">ВАШЕ ПУТЕШЕСТВИЕ</span><h2>В своём ритме</h2></div><button id="sound" class="setting-row">Звук <span id="sound-state">Выкл.</span></button><button id="vibration" class="setting-row">Вибрация <span id="vibration-state">Вкл.</span></button><button id="install-settings" class="setting-row" data-install-btn><span>Установка на устройство</span><span class="install-text">Скачать</span></button><div class="instructions"><h3>Играйте вдвоём</h3><p>Держите телефон горизонтально. Верхняя дорожка — София, нижняя — Стелла. Кнопки слева управляют Софией, справа — Стеллой. Вверху — прыжок, внизу — присед.</p><p>Обходите препятствия и ловите бонусы: +10 за препятствие, +25 за находку. В каждом мире у вас по три жизни.</p><p>София: W — прыжок, S — присед. Стелла: ↑ — прыжок, ↓ — присед. Удерживайте присед под верхними препятствиями; наземные нужно перепрыгивать. Пауза: Escape.</p></div><div class="settings-art"></div></section>
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
function renderSelection() {
  const row=journey.choosing;
  document.querySelector('#choosing-player')!.textContent=`ИГРОК ${row+1} · ${row===0?'СЛЕВА':'СПРАВА'}`;
  document.querySelector('#selection-step')!.textContent=`0${row+1} / 0${journey.count}`;
  document.querySelector('#character-grid')!.innerHTML=CHARACTERS.map((hero,i)=>`<button class="character-card ${journey.selected[row]===i?'selected':''}" data-character="${i}" style="--hero-color:${hero.color}" aria-pressed="${journey.selected[row]===i}" ${row===1&&journey.selected[0]===i?'disabled':''}>${portraitMarkup(hero)}<span class="character-name">${hero.name}</span><span class="character-element">${hero.symbol} · ${hero.element}</span>${petMarkup(hero)}<small>${row===1&&journey.selected[0]===i?'Выбран игроком 1':hero.petName}</small></button>`).join('');
  document.querySelectorAll<HTMLElement>('[data-character]').forEach(button=>button.addEventListener('click',()=>{if(journey.choose(Number(button.dataset.character)))renderSelection();}));
  document.querySelector('#party-preview')!.innerHTML=journey.selected.map((_,i)=>`<span class="party-slot ${i===row?'current':''}"><small>ИГРОК ${i+1}</small><b>${i<=row?heroFor(i).name:'Ожидает выбора'}</b></span>`).join('');
  const confirm=document.querySelector<HTMLButtonElement>('#confirm-character')!;confirm.disabled=!adventure;confirm.textContent=adventure?(row===0?'Выбрать для игрока 1 →':'Отправиться вместе →'):'Загрузка персонажей…';
}
document.querySelector('#selection-back')!.addEventListener('click',()=>{if(journey.choosing===1){journey.choosing=0;renderSelection();}else showScreen('home');});
document.querySelector('#confirm-character')!.addEventListener('click',()=>{if(!adventure)return;if(journey.confirm()){showScreen('play-screen');adventure.prepareLevel(true);}else renderSelection();});

function readSetting(key:string, fallback:string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function saveSetting(key:string,value:string) { try { localStorage.setItem(key,value); } catch {} }
let vibration=readSetting('vibration','true')==='true';
document.querySelector('#settings-open')!.addEventListener('click',()=>showScreen('settings'));
document.querySelector('#exit-menu')!.addEventListener('click',()=>{showScreen('farewell');if(document.fullscreenElement)void document.exitFullscreen();});
async function startLocal(count:number){if(startingLocal)return;startingLocal=true;try{attempt=await api<Attempt>('attempts',{count});}catch{attempt=undefined;}finally{startingLocal=false;}logs=[[],[],[]];journey.count=count;document.querySelector('.mobile-app')!.classList.toggle('solo',count===1);if(adventure){adventure.playing=false;adventure.awaitingReady=false;adventure.paused=false;adventure.anims.paused=false;adventure.clearDuck();}(document.querySelector('#continue') as HTMLButtonElement).disabled=true;journey.reset();showScreen('character-select');renderSelection();}
document.querySelector('#play-menu')!.addEventListener('click',()=>void startLocal(2));
document.querySelector('#solo-menu')!.addEventListener('click',()=>void startLocal(1));
document.querySelectorAll('.back-home').forEach(el=>el.addEventListener('click',()=>showScreen('home')));
document.querySelector('#vibration')!.addEventListener('click',()=>{vibration=!vibration;saveSetting('vibration',String(vibration));document.querySelector('#vibration-state')!.textContent=vibration?'Вкл.':'Выкл.';});
document.querySelector('#vibration-state')!.textContent=vibration?'Вкл.':'Выкл.';
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
let audio: AudioContext | undefined;
let sound = readSetting('sound','false')==='true';
function beep(freq: number) { if (!sound) return; try { audio ??= new AudioContext(); void audio.resume(); const o=audio.createOscillator(), g=audio.createGain(); o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.start();o.stop(audio.currentTime+.12); } catch {} }
interface Runner { duckInputs: Set<string>; ducking: boolean; y: number; velocity: number; sprite: Phaser.GameObjects.Sprite; pet: Pet; magic: ElementMagic }
interface Item { x: number; kind: Spawn['kind']; row: number; passed: boolean; icon: Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Container; obstacle: ObstacleType; width: number }
class Adventure extends Phaser.Scene {
  level=0; players: Player[]=[newPlayer(),newPlayer()]; runners: Runner[]=[]; items: Item[]=[];
  background?: WorldBackground; orientationPaused=false; awaitingReady=false; readyCountdown=0; idleTime=0;
  accumulator=0; elapsed=0; next=0; plan: (Spawn & {row:number})[]=[]; playing=false; paused=false; started=false; seed=Date.now();
  preload() {
    this.load.image('candy-panorama', 'art/candy-world.png');
    for (const hero of CHARACTERS) { const atlas=hero.clean?'atlas-elemental':'atlas';this.load.atlas(hero.key,`assets/characters/${hero.key}/${atlas}.png`,`assets/characters/${hero.key}/${atlas}.json`); }
    for(const key of ['eagle','fox','eagle-rest','eagle-fly','fox-rest','fox-run','black-cat-rest','ginger-cat-rest','air-cat','earth-cat'])this.load.image(key,`assets/pets/${key}.png`);
    for (const key of ['black-cat','ginger-cat']) this.load.spritesheet(key,`assets/pets/${key}.png`,{frameWidth:128,frameHeight:128});
    for (const key of ['rock','stakes','log','lantern','banner']) this.load.image(key,`assets/obstacles/${key}.png`);
  }
  create() {
    for (const hero of CHARACTERS) {
      for (const [action,count,rate,repeat] of [['run',hero.run,12,-1],['hit',2,5,0],['idle',hero.idle,3,-1],['duck',hero.duck,8,0]] as const) {
        this.anims.create({key:`${hero.key}-${action}`,frames:Array.from({length:count},(_,i)=>({key:hero.key,frame:`${action}-${String(i).padStart(2,'0')}`})),frameRate:rate,repeat});
      }
    }
    for (const key of ['black-cat','ginger-cat']) {
      this.anims.create({key:`${key}-run`,frames:this.anims.generateFrameNumbers(key,{start:0,end:3}),frameRate:10,repeat:-1});
    }
    this.drawWorld();
    adventure=this;this.scene.setVisible(false);renderSelection();
    document.querySelector('#result-menu')!.addEventListener('click',()=>{showScreen('home');(document.querySelector('#continue') as HTMLButtonElement).disabled=true;});
    const goHome=()=>this.goHome();
    document.querySelector('#home-button')!.addEventListener('click',goHome);
    document.querySelector('#rotate-home')!.addEventListener('click',goHome);
    document.querySelector('#continue')!.addEventListener('click',()=>{showScreen('play-screen');if(this.paused)this.togglePause();this.checkOrientation();this.resizeArena();});
    this.input.keyboard?.on('keydown', (event: KeyboardEvent)=> {
      if(document.querySelector<HTMLElement>('#play-screen')!.hidden)return;
      if (['ArrowUp','ArrowDown','Space'].includes(event.code)) event.preventDefault();
      if(event.repeat)return;
      if(event.code==='KeyW')this.jump(0);
      if(event.code==='ArrowUp')this.jump(journey.count===1?0:1);
      if(event.code==='KeyS')this.duck(0,'keyboard',true);
      if(event.code==='ArrowDown')this.duck(journey.count===1?0:1,'keyboard',true);
      if(event.code==='Escape'&&this.playing)this.togglePause();
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
  goHome(){if(this.playing&&!this.paused)this.togglePause();this.orientationPaused=false;showScreen('home');(document.querySelector('#continue') as HTMLButtonElement).disabled=!(this.playing||this.awaitingReady);}
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
    this.items.forEach(item=>item.icon.y=this.ground(item.row)-(item.kind==='bonus'?(item.obstacle==='overhead'?32:112):0));
    this.checkOrientation();
  }
  drawWorld() {
    this.children.removeAll(true);this.items=[];this.runners=[];
    this.background = new WorldBackground(this, this.level, journey.count);
    for(let row=0;row<journey.count;row++) {
      const floor=this.ground(row);
      const hero=heroFor(row);
      const sprite=this.add.sprite(160,floor,hero.key,'idle-00').setOrigin(.5,240/256).setScale(hero.scale).play(`${hero.key}-idle`);
      const pet=new Pet(this,row,floor,hero.pet);
      const magic=new ElementMagic(this,hero.key);
      this.runners.push({duckInputs:new Set(),ducking:false,y:0,velocity:0,sprite,pet,magic});
    }
  }
  prepareLevel(reset=false) {
    if(reset){this.level=0;this.players=journey.selected.map(()=>newPlayer());this.seed=attempt?.seed??Date.now();}
    else this.players=this.players.map(p=>newPlayer(p.score));
    this.playing=false;this.paused=false;this.awaitingReady=true;this.readyCountdown=0;this.started=true;this.anims.paused=false;journey.resetReady();
    this.elapsed=0;this.accumulator=0;this.next=0;this.plan=journey.selected.flatMap((_,row)=>route(this.seed+this.level,row).map(s=>({...s,row}))).sort((a,b)=>a.at-b.at);this.resizeArena();this.drawWorld();this.hud();this.updateHeroLabels();
    (document.querySelector('#continue') as HTMLButtonElement).disabled=false;
    (document.querySelector('#pause') as HTMLButtonElement).disabled=true;
    document.querySelector('#world-title')!.textContent=`УРОВЕНЬ ${this.level+1} · ${WORLDS[this.level].name}`;
    this.renderReady();
    document.querySelector('#selection-hint')!.textContent=attempt?'Результат можно записать в общий рейтинг.':'Автономная игра · без записи в общий рейтинг';
  }
  updateHeroLabels(){
    journey.selected.forEach((_,row)=>{
      const hero=heroFor(row),controls=document.querySelectorAll<HTMLElement>('.player-controls')[row],label=document.querySelectorAll<HTMLElement>('.lane-label')[row];
      controls.style.setProperty('--hero-color',hero.color);controls.dataset.hero=hero.key;
      controls.querySelector('.jump strong')!.textContent=hero.name;controls.querySelector('.jump-element')!.textContent=hero.symbol;
      controls.querySelector('.jump')!.setAttribute('aria-label',`Прыжок игрока ${row+1}, ${hero.name}`);
      controls.querySelector('.duck-control')!.setAttribute('aria-label',`Присед игрока ${row+1}, ${hero.name}`);
      label.querySelector('strong')!.textContent=`Игрок ${row+1} · ${hero.name}`;label.querySelector('.avatar')!.textContent=hero.symbol;
    });
  }
  renderReady(){
    overlay.hidden=false;overlay.classList.add('ready-overlay');
    overlay.innerHTML=journey.selected.map((_,row)=>`<div class="ready-card ${journey.ready[row]?'is-ready':''}"><span class="eyebrow">ИГРОК ${row+1} · ${heroFor(row).name}</span><h2>${journey.ready[row]?'Готов!':'Готовы в путь?'}</h2><p>${journey.ready[row]?'Ждём напарника…':heroFor(row).companionReadyText}</p><button class="primary" data-ready="${row}" ${journey.ready[row]?'disabled':''}>${journey.ready[row]?'✓ Готов':`Я готов · ${row===0?'W / S':'↑ / ↓'}`}</button></div>`).join('');
    overlay.querySelectorAll<HTMLElement>('[data-ready]').forEach(button=>button.addEventListener('click',()=>this.markReady(Number(button.dataset.ready))));
    if(journey.ready.every(Boolean))overlay.querySelectorAll('p').forEach(p=>p.textContent='Вперёд, вместе!');
  }
  markReady(row:number){
    if(!this.awaitingReady||document.querySelector<HTMLElement>('#play-screen')!.hidden||this.readyCountdown>0)return;
    if(journey.markReady(row))this.readyCountdown=.8;
    this.renderReady();beep(row===0?470:560);
  }
  begin() {
    this.awaitingReady=false;this.readyCountdown=0;this.playing=true;this.paused=false;this.anims.paused=false;overlay.hidden=true;overlay.classList.remove('ready-overlay');
    this.runners.forEach((r,row)=>r.sprite.setScale(heroFor(row).scale));
    (document.querySelector('#pause') as HTMLButtonElement).disabled=false;document.querySelector('#pause')!.textContent='Ⅱ';
    this.orientationPaused=false;this.checkOrientation();
  }
  jump(row:number){if(this.awaitingReady){this.markReady(row);return;}const r=this.runners[row];if(!this.playing||this.paused||r.duckInputs.size>0||r.y<-.1)return;logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'jump',pressed:true});r.velocity=JUMP_VELOCITY;if(vibration)navigator.vibrate?.(15);beep(row===0?470:560);}
  duck(row:number,source:string,pressed:boolean){
    const r=this.runners[row];if(!r)return;
    if(!pressed){const was=r.duckInputs.size>0;r.duckInputs.delete(source);if(was&&!r.duckInputs.size&&this.playing)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:false});return;}
    if(this.awaitingReady){this.markReady(row);return;}
    if(!this.playing||this.paused)return;
    if(!r.duckInputs.size)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:true});r.duckInputs.add(source);
  }
  clearDuck(){this.runners.forEach((r,row)=>{if(r.duckInputs.size&&this.playing)logs[this.level].push({tick:Math.round(this.elapsed/20),player:row,kind:'duck',pressed:false});r.duckInputs.clear();r.ducking=false;});}
  togglePause(){if(!this.playing)return;this.paused=!this.paused;this.clearDuck();this.anims.paused=this.paused;document.querySelector('#pause')!.textContent=this.paused?'▶':'Ⅱ';overlay.hidden=!this.paused;if(this.paused){overlay.innerHTML='<div class="intro-mark">Ⅱ</div><h2>Маленькая передышка</h2><p>Ваше приключение подождёт.</p><button id="resume" class="primary">Продолжить →</button><button id="pause-home" class="secondary">В главное меню</button>';document.querySelector('#resume')!.addEventListener('click',()=>this.togglePause());document.querySelector('#pause-home')!.addEventListener('click',()=>this.goHome());}}
  spawn(s:Spawn & {row:number}){const row=s.row;{
    const bonus=s.kind==='bonus', x=1150, obstacle=s.obstacle??'ground';
    let icon: Item['icon'];
    if(bonus) icon=this.add.text(x,this.ground(row)-(obstacle==='overhead'?32:112),WORLDS[this.level].bonus,{fontSize:'27px',fontFamily:'Arial'}).setOrigin(.5,1);
    else if(obstacle==='overhead'){
      const key=`arch-${this.level}`;if(!this.textures.exists(key)){const texture=this.textures.createCanvas(key,140,160)!;drawArch(texture.context,65,155,this.level);texture.refresh();}const log=this.add.image(0,0,key).setOrigin(65/140,155/160);
      const cue=this.add.text(0,-120,'↓',{fontSize:'15px',fontFamily:'Arial',color:'#ffffff',backgroundColor:'#243c48',padding:{x:5,y:3}}).setOrigin(.5,1);
      icon=this.add.container(x,this.ground(row),this.level===0?[log,cue]:[log]);
    }else { const obstacleImage=this.add.image(0,0,['rock','stakes','log'][s.variant]).setOrigin(.5,176/192).setScale(.46); const arrows=this.level===0?[this.add.text(0,-75,'↑',{fontSize:'24px',color:'#ffffff'}).setOrigin(.5)]:[]; icon=this.add.container(x,this.ground(row),[obstacleImage,...arrows]); }
    this.items.push({x,kind:s.kind,row,passed:false,icon,obstacle,width:bonus?24:32});
  }}
  hud(){this.players.forEach((p,i)=>{document.querySelector(`#lives-${i}`)!.textContent=p.lives===0?'👻 Призрак':'♥ '.repeat(p.lives)+'♡ '.repeat(3-p.lives);document.querySelector(`#score-${i}`)!.innerHTML=`${p.score} <small>очков</small>`;});const seconds=Math.ceil(Math.max(0,LEVEL_SECONDS-this.elapsed/1000));document.querySelector('#timer')!.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  finish(){
    this.playing=false;this.awaitingReady=false;this.clearDuck();this.runners.forEach(r=>{r.sprite.stop();r.pet.stop();r.magic.clear();});
    (document.querySelector('#pause') as HTMLButtonElement).disabled=true;(document.querySelector('#continue') as HTMLButtonElement).disabled=true;
    const lost=false,last=this.level===WORLDS.length-1;
    const result=document.querySelector<HTMLElement>('#result')!;result.classList.toggle('is-defeat',lost);
    document.querySelector('#result-eyebrow')!.textContent=`УРОВЕНЬ ${this.level+1} · ${WORLDS[this.level].name}`;
    document.querySelector('#result-title')!.textContent=lost?'Ещё одна попытка?':last?'Равновесие восстановлено!':'Уровень пройден!';
    document.querySelector('#result-description')!.textContent=lost?'Отдохните вместе с котиками и попробуйте снова.':last?'Все три мира позади. Ваша команда справилась!':'Ваша команда и верные котики готовы идти дальше.';
    document.querySelector('#result-party')!.innerHTML=journey.selected.map(i=>`<div>${portraitMarkup(CHARACTERS[i])}${petMarkup(CHARACTERS[i])}</div>`).join('');
    document.querySelector('#result-scores')!.innerHTML=this.players.map((p,i)=>`<div><strong>${heroFor(i).name}</strong><b>${p.score}</b><small>очков · ${p.lives} ♥</small></div>`).join('');
    const next=document.querySelector<HTMLButtonElement>('#result-next')!;next.textContent=lost?'Попробовать снова':last?'Новое путешествие':'Следующий уровень →';
    next.onclick=()=>{if(last&&!lost){void startLocal(journey.count);return;}if(!lost)this.level++;showScreen('play-screen');if(lost){const totals=this.players.map(p=>Math.max(0,p.score-p.roundScore));this.players=totals.map(score=>newPlayer(score));}this.prepareLevel();};
    showScreen('result');
    document.querySelectorAll('.winner-form,.ranking-note').forEach(el=>el.remove());
    if(last){const target=document.querySelector<HTMLElement>('#result-scores')!;const note=document.createElement('p');note.className='ranking-note';note.textContent=attempt?'Проверяем результат…':'Автономное путешествие завершено. Для рейтинга начните новую игру с интернетом.';target.append(note);if(attempt){const current=attempt;void api<{id:string;players:Player[]}>(`attempts/${current.id}/finish`,{token:current.token,heroes:journey.selected,logs}).then(data=>{if(attempt!==current)return;note.textContent='Результат проверен';nameForms(target,data.id,current.token,data.players);}).catch(()=>{note.textContent='Не удалось проверить результат. Проверьте связь и повторите.';const retry=document.createElement('button');retry.textContent='Повторить отправку';retry.className='secondary';retry.onclick=()=>{retry.disabled=true;void api<{id:string;players:Player[]}>(`attempts/${current.id}/finish`,{token:current.token,heroes:journey.selected,logs}).then(data=>{note.textContent='Результат проверен';retry.remove();nameForms(target,data.id,current.token,data.players)}).catch(err=>{note.textContent=String(err);retry.disabled=false})};note.append(retry);});}}
  }
  update(_time:number,delta:number){
    if(document.querySelector<HTMLElement>('#play-screen')!.hidden)return;
    const dt=Math.min(delta,40)/1000;
    if(this.awaitingReady){
      this.idleTime+=dt;
      this.runners.forEach((r,row)=>{const scale=heroFor(row).scale;r.sprite.setScale(scale*(1+Math.sin(this.idleTime*2+row)*.012),scale);r.pet.idle(dt,this.ground(row));});
      if(this.readyCountdown>0&&!window.matchMedia('(orientation: portrait)').matches){this.readyCountdown-=dt;if(this.readyCountdown<=0)this.begin();}
      return;
    }
    if(!this.playing||this.paused)return;this.accumulator+=Math.min(delta,100);while(this.accumulator>=20&&this.playing){this.accumulator-=20;this.step();}
  }
  step(){
    const dt=.02;this.elapsed+=20;this.background?.update(dt,this.elapsed);
    while(this.next<this.plan.length&&this.plan[this.next].at<=this.elapsed)this.spawn(this.plan[this.next++]);
    this.runners.forEach((r,i)=>{r.velocity+=GRAVITY*dt;r.y=Math.min(0,r.y+r.velocity*dt);if(r.y===0)r.velocity=0;r.ducking=r.y===0&&r.duckInputs.size>0;const hero=heroFor(i).key;
      r.sprite.anims.timeScale=1;
      if(this.elapsed < this.players[i].invulnerable && this.elapsed > this.players[i].invulnerable-650) {
        r.sprite.stop();r.sprite.setFrame(this.elapsed<this.players[i].invulnerable-450?'hit-00':'hit-01');
      } else if(r.y<0){r.sprite.stop();r.sprite.setFrame(r.velocity< -150?'jump-00':r.velocity<150?'jump-01':'jump-02');}
      else if(r.ducking){
        if(r.sprite.anims.currentAnim?.key!==`${hero}-duck`||!String(r.sprite.frame.name).startsWith('duck-'))r.sprite.play(`${hero}-duck`);
      } else {r.sprite.anims.timeScale=WORLDS[this.level].speed/270;r.sprite.play(`${hero}-run`,true);}
      r.sprite.y=this.ground(i)+r.y;
      const hurt=String(r.sprite.frame.name).startsWith('hit-');
      r.magic.update(dt,r.sprite.x,r.sprite.y,this.ground(i),hurt?'none':r.y<0?'jump':r.ducking?'duck':'none',WORLDS[this.level].speed);
      r.pet.update(dt,this.ground(i),r.y,r.ducking);r.sprite.alpha=this.players[i].lives===0?.35:this.elapsed<this.players[i].invulnerable?(Math.floor(this.elapsed/100)%2?.4:1):1;});
    for(const item of this.items){item.x-=WORLDS[this.level].speed*dt;item.icon.x=item.x;const p=this.players[item.row],r=this.runners[item.row];
      if(!item.passed&&Math.abs(item.x-160)<(item.kind==='bonus'?30:28)){if(item.kind==='obstacle'&&obstacleCollision(r.y,r.ducking,item.obstacle)){item.passed=true;if(hit(p,this.elapsed))beep(150);}else if(item.kind==='bonus'&&(item.obstacle==='overhead'?r.ducking&&r.y===0:r.y<-35&&r.y>-146)){award(p,25);item.passed=true;item.icon.setVisible(false);beep(850);}}
      if(!item.passed&&item.x<120){if(item.kind==='obstacle')award(p,10);item.passed=true;}
    }
    this.items=this.items.filter(item=>{if(item.x<-50){item.icon.destroy();return false;}return true;});this.hud();if(this.elapsed>=LEVEL_SECONDS*1000)this.finish();
  }
}
export const game = new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1100,height:530,backgroundColor:'#f8dfea',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Adventure,render:{antialias:true},input:{activePointers:3}});
document.querySelector('#sound-state')!.textContent=sound?'Вкл.':'Выкл.';
document.querySelector('#sound')!.addEventListener('click',()=>{sound=!sound;saveSetting('sound',String(sound));document.querySelector('#sound-state')!.textContent=sound?'Вкл.':'Выкл.';if(sound)beep(660);});
initPWA();

const network=mountNetwork(showScreen);
document.querySelector('#online-menu')!.addEventListener('click',()=>{adventure?.goHome();network.open();});
document.querySelector('#ranking-menu')!.addEventListener('click',()=>network.ranking());
try{if(new URLSearchParams(location.search).has('room')||sessionStorage.getItem('jump-room'))network.open();}catch{}
