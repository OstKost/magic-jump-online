import { AnimationV2, StellaAnimation, chooseStellaSpell, actionRandom, chooseSpell } from './animation-v2';
import { OBSTACLE_ANIMATIONS, obstacleAnimationKey, obstacleFrame, obstacleFrameRect, obstaclePhase } from './obstacle-animations';
import { drawTerrain } from './terrain-art';
import { getBonusFloatOffset, getBonusGlowAlpha, getBonusFrameIndex, drawSparkleStar } from './bonus-art';
import { gameAudio } from './audio';
import { ENEMIES, SPELLS } from './combat';
import { drawSpell } from './combat-art';
import './online.css';
import { actionIcon, castButtonContent, dashButtonContent } from './game-controls';
import QRCode from 'qrcode';
import { renderElementalQR } from './elemental-qr';
import { CHARACTERS, availableCharacters, portraitMarkup, petMarkup } from './characters';
import { WORLDS, JUMP_VELOCITY, DIFFICULTIES, type DifficultyKey } from './rules';
import { mountRankingRecovery, rankingDeliveryMessage, RankingApiError, getLocalRecords, submitRankingResult, syncPendingRankings, openSkipConfirm, TOP_RANKING_LIMIT } from './ranking.ts';
import { setButtonProgress } from './button-progress';

export interface Action { tick:number; player:number; kind:'jump'|'duck'|'cast'|'dash'; pressed:boolean }
export interface Attempt { id:string; token:string; seed:number; count:number; difficulty?:string }
export async function api<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok){const text=await response.text();let detail:{code?:string;message?:string;retryable?:boolean}={};try{detail=JSON.parse(text)}catch{}throw new RankingApiError(response.status,detail.code??`http_${response.status}`,detail.message??text,detail.retryable??(response.status>=500||response.status===429));}return response.json() as Promise<T>;
}
export function nameForms(target:HTMLElement,id:string,token:string,players:{score:number;eligible?:boolean}[],only?:number,difficulty:DifficultyKey='medium',deviceOnly=false){
 players.forEach((player,i)=>{
  if(only!==undefined&&only!==i||!deviceOnly&&player.eligible===false)return;
  const form=document.createElement('form');form.className='winner-form';
  const label=document.createElement('label');label.textContent=`Игрок ${i+1} · ${player.score} очков · ${deviceOnly?'только на устройстве':'личный рейтинг'}`;
  const input=document.createElement('input');input.required=true;input.maxLength=20;input.placeholder='Ваше имя';input.setAttribute('aria-label',`Имя игрока ${i+1}`);
  const button=document.createElement('button');button.className='primary';button.textContent=deviceOnly?'Сохранить на устройстве':'Записать в рейтинг';
  const status=document.createElement('p');status.setAttribute('role','status');form.append(label,input,button,status);target.append(form);
  form.onsubmit=async event=>{event.preventDefault();button.disabled=true;const result=await submitRankingResult({id,token,player:i,name:input.value,score:player.score,difficulty,deviceOnly},api);status.textContent=rankingDeliveryMessage(result);input.disabled=result.ok;button.disabled=result.ok;};
 });
}

const senseiAnimations = new Map<number, { animation: AnimationV2; jumps: number; duck: boolean; ready: number; lives: number; hurtUntil: number }>();
interface Body {grounded?:boolean;fallUntil?:number;readyAt?:number;readyDashAt?:number;lives:number;score:number;y:number;velocity:number;duck:boolean;hero:number;connected:boolean;eligible:boolean;jumps?:number}
interface Item {at?:number;offset?:number;width?:number;height?:number;defeatedAt?:number;x:number;player:number;passed:boolean;kind:string;obstacle:string;variant:number}
interface Room {serverTime?:number;persistence?:'pending'|'saved'|'error'|'device-only';persistenceError?:string;code:string;id:string;host:string;phase:string;difficulty?:DifficultyKey;members:{id:string;hero:number;ready:boolean;connected:boolean;reconnectDeadline?:number}[];engine?:{tick:number;level:number;world:number;players:Body[];items:Item[];projectiles?:{y?:number;x:number;distance:number;player:number}[]}}
interface Session {code:string;id:string;token:string}
export function mountNetwork(show:(id:string)=>void){
 const root=document.querySelector('.mobile-app')!;
 root.insertAdjacentHTML('beforeend',`
 <section id="online" class="screen online-screen" hidden>
  <header class="online-header"><button id="online-back" class="icon-button" aria-label="Вернуться в меню">←</button><span class="online-wordmark">МАГИ СТИХИЙ <i>◇</i> ОДНО ПРИКЛЮЧЕНИЕ</span><span id="connection-status" class="connection-status" role="status"></span></header>
  <p id="online-reconnect" role="status" hidden></p>
  <div id="room-entry" class="room-entry">
   <div class="online-intro"><span class="eyebrow">ВОЛШЕБНЫЙ ПРЫЖОК · ОНЛАЙН</span><h2>Друзья, <em>в путь!</em></h2><p>Соберите команду и отправляйтесь на три этапа: обучение и два разных мира. Онлайн-матч не ставится на паузу: при потере связи игра продолжается, на возврат даётся до 30 секунд.</p></div>
   <div class="room-paths">
    <article class="room-path room-path-create"><div class="path-runes" aria-hidden="true"><span>水</span><span>火</span><span>風</span><span>土</span></div><span class="eyebrow">ВАШЕ ПРИКЛЮЧЕНИЕ</span><h3>Собрать команду</h3><p>Откройте комнату и позовите до трёх друзей.</p><button id="create-room" class="primary">Создать комнату <span aria-hidden="true">✦</span></button></article>
    <div class="paths-ornament" aria-hidden="true">◇</div>
    <article class="room-path room-path-join"><span class="path-key" aria-hidden="true">✦</span><span class="eyebrow">ВАС УЖЕ ЖДУТ</span><h3>К своим друзьям</h3><form id="join-room"><label for="room-code">Введите код приглашения</label><input id="room-code" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required placeholder="0000" autocomplete="off" aria-label="Код комнаты, четыре цифры"><button class="primary">Присоединиться <span aria-hidden="true">→</span></button></form></article>
   </div>
   <p class="online-footnote">2–4 игрока · Каждый на своём устройстве</p>
  </div>
  <p id="online-error" role="alert"></p>
  <div id="lobby" class="online-lobby" hidden>
   <div class="online-lobby-layout">
    <aside class="room-invite"><span class="eyebrow">ПРИГЛАСИТЕ ДРУЗЕЙ</span><span class="invite-caption">Код вашей комнаты</span><strong id="invite-code"></strong><div class="qr-frame"><div class="qr-elemental-runes" aria-hidden="true"><span>水 💧</span><span>火 🔥</span><span>土 🍃</span><span>風 ⚡</span></div><canvas id="room-qr" aria-label="QR-код приглашения"></canvas></div><span class="invite-note">Введите код или отсканируйте QR</span><button id="copy-invite" class="secondary">Скопировать приглашение ↗</button></aside>
    <div class="online-party"><div class="online-party-heading"><div><span class="eyebrow">СОБЕРИТЕ СВОЮ КОМАНДУ</span><h2 id="lobby-title">Выберите свою стихию</h2></div><span id="room-count" class="room-count"></span></div><div id="online-difficulty-picker" class="online-difficulty-picker" role="group" aria-label="Сложность игры"><div class="difficulty-picker-header"><span class="difficulty-picker-label">Сложность приключения</span><span id="online-diff-hint" class="online-diff-hint"></span></div><div class="online-difficulty-tabs"><button type="button" class="online-diff-btn" data-online-diff="easy"><span class="diff-icon">🌸</span><strong>Лёгкий</strong><small>20 сек · 4 жизни</small></button><button type="button" class="online-diff-btn is-active" data-online-diff="medium"><span class="diff-icon">⭐</span><strong>Средний</strong><small>40 сек · 3 жизни</small></button><button type="button" class="online-diff-btn" data-online-diff="hard"><span class="diff-icon">🔥</span><strong>Сложный</strong><small>50 сек · 3 жизни</small></button></div></div><p id="hero-choice-hint" class="hero-choice-hint">Выбирайте любого героя — даже если друг уже играет им.</p><div id="online-hero-picker" class="online-hero-picker" role="group" aria-label="Выбор персонажа"></div><div id="online-members" aria-label="Участники комнаты"></div><footer class="lobby-actions"><p id="lobby-guidance" role="status"></p><button id="online-ready" class="primary">Я готов <span aria-hidden="true">✓</span></button><button id="online-start" class="primary">Начать игру <span aria-hidden="true">→</span></button></footer></div>
   </div>
  </div>
  <div id="online-match" hidden><div id="online-clock"></div><div id="opponent-lanes" aria-label="Экраны друзей"></div><div id="own-lane"></div><div class="online-controls" aria-label="Управление вашим героем"><button id="online-duck" aria-label="Присесть, удерживайте">${actionIcon('duck')}<strong>Присесть</strong><kbd>S / ↓</kbd></button><button id="online-cast" class="cast-control" aria-label="Атака">${castButtonContent('A / ←')}</button><button id="online-dash" class="dash-control" aria-label="Рывок">${dashButtonContent('D / →')}</button><button id="online-jump" aria-label="Прыжок">${actionIcon('jump')}<strong>Прыжок</strong><kbd>W / ↑</kbd></button></div></div>
  <div id="online-stage-clear" class="online-stage-clear" hidden>
    <div class="stage-clear-content">
      <span class="eyebrow">ЭТАП ПРОЙДЕН! 🌟</span>
      <h2 id="stage-clear-title">Мир покорен!</h2>
      <p id="stage-clear-subtitle">Все герои справились с препятствиями. Впереди следующее испытание!</p>
      <div id="stage-clear-scores" class="stage-clear-scores"></div>
      <div class="stage-next-preview">
        <span class="eyebrow">СЛЕДУЮЩИЙ МИР</span>
        <h3 id="stage-next-world-name"></h3>
      </div>
      <footer class="stage-clear-actions">
        <p id="stage-clear-guidance" role="status"></p>
        <button id="stage-clear-ready" class="primary">Готов к следующему миру ✓</button>
        <button id="stage-clear-start" class="primary" hidden>Вперёд к новым мирам →</button>
      </footer>
    </div>
  </div>
  <div id="online-rotate-notice" class="rotate-notice" hidden>
    <span>⤾</span>
    <h2>Поверните телефон</h2>
    <p>Играйте горизонтально: управление слева и справа,<br>дорожки героев — в центре экрана.</p>
  </div>
  <div id="online-result" hidden></div>
 </section>
 <section id="ranking" class="screen panel ranking-screen" hidden>
  <div class="panel-top"><button id="ranking-back" class="icon-button back-home" aria-label="Назад">←</button><span class="screen-label">ТУРНИР ЧЕТЫРЁХ СТИХИЙ</span><button id="ranking-reload" class="icon-button ranking-reload-btn" aria-label="Обновить" title="Обновить список">↻</button></div>
  <div class="ranking-heading"><span class="eyebrow">ЗАЛ СЛАВЫ</span><h2>Рейтинг недели · Топ 20</h2><p id="ranking-week" class="ranking-week-text"></p><div class="ornament" aria-hidden="true">──── ◇ ────</div></div>
  <div class="ranking-difficulty-tabs" role="tablist" aria-label="Выбор сложности рейтинга">
    <button class="ranking-tab" data-diff="easy" role="tab" aria-selected="false"><span class="tab-icon">🌸</span><span>Лёгкий</span><small>20 сек</small></button>
    <button class="ranking-tab is-active" data-diff="medium" role="tab" aria-selected="true"><span class="tab-icon">⭐</span><span>Средний</span><small>40 сек</small></button>
    <button class="ranking-tab" data-diff="hard" role="tab" aria-selected="false"><span class="tab-icon">🔥</span><span>Сложный</span><small>50 сек</small></button>
  </div>
  <div id="ranking-content" class="ranking-content"><p id="ranking-status" role="status" class="ranking-status"></p><ol id="ranking-list" class="ranking-list"></ol></div>
  <div class="ranking-rules-card"><div class="rules-card-icon" aria-hidden="true">🏆</div><div><strong>Как попасть на Доску почёта?</strong><p>Пройдите три этапа на выбранной сложности. Каждый участник финиша записывает своё имя, даже призрак. Общий личный рейтинг недели объединяет подтверждённые сервером и офлайн-результаты с отметками. Поражения остаются только на устройстве.</p></div></div>
  <div class="ranking-footer-actions"><button class="primary back-home">В главное меню ←</button></div>
 </section>`);
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 let session:Session|undefined,ws:WebSocket|undefined,room:Room|undefined,closed=true,retry:number|undefined,heartbeat:number|undefined,finishedID='',previousSignature='',qrCode='';
 let lastTick=0,lastReceived=0;const canvases=new Map<number,HTMLCanvasElement>();
 const images=new Map<string,HTMLImageElement>();const atlases=new Map<string,Record<string,{frame:{x:number;y:number;w:number;h:number}}>>();
 function loadImage(path:string){let image=images.get(path);if(!image){image=new Image();image.src=path;images.set(path,image)}return image}
 for(const hero of CHARACTERS){const atlas=hero.key==='stella'?'atlas-v2':hero.clean?'atlas-elemental':'atlas';loadImage(`/assets/characters/${hero.key}/${atlas}.png`);void fetch(`/assets/characters/${hero.key}/${atlas}.json`).then(r=>r.json()).then(data=>atlases.set(hero.key,data.frames)).catch(()=>{});loadImage(`/assets/pets/${hero.petRest}.png`)}
 for(const animation of Object.values(OBSTACLE_ANIMATIONS))loadImage(animation.path);
 function transmit(type:string,extra:object={}){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type,...extra}));if(type==='jump'&&room?.phase==='playing'&&room.engine){const me=room.members.findIndex(m=>m.id===session?.id);const p=room.engine.players[me];if(p&&!p.duck){if(p.y===0){p.velocity=JUMP_VELOCITY;p.y=JUMP_VELOCITY*.02;p.jumps=1;}else if((p.jumps||0)<2){p.velocity=JUMP_VELOCITY;p.jumps=2;}}}}}
 let entering = false, entryVersion = 0, entryTimer: number | undefined;
 let pendingLobby: { accepts: (next: Room) => boolean; timer: number } | undefined;
 let lobbyConnected = false;
 function entryBusy(busy: boolean, action?: 'create' | 'join'){
  entering = busy;
  const createBtn = el<HTMLButtonElement>('create-room');
  const joinBtn = el<HTMLFormElement>('join-room').querySelector<HTMLButtonElement>('button')!;
  createBtn.disabled = busy;
  el<HTMLButtonElement>('room-code').disabled = busy;
  joinBtn.disabled = busy;
  el('room-entry').setAttribute('aria-busy', String(busy));
  el('connection-status').classList.toggle('request-loading', busy);
  if (busy) {
    if (action === 'create') {
      setButtonProgress(createBtn, { loading: true, determinate: false, loadingText: 'Создаём комнату…' });
    } else if (action === 'join') {
      setButtonProgress(joinBtn, { loading: true, determinate: false, loadingText: 'Подключение…' });
    }
  } else {
    setButtonProgress(createBtn, { loading: false, readyText: 'Создать комнату ✦' });
    setButtonProgress(joinBtn, { loading: false, readyText: 'Войти →' });
  }
 }
 function clearLobbyPending(){
  if(pendingLobby)window.clearTimeout(pendingLobby.timer);
  pendingLobby = undefined;
  previousSignature = '';
 }
 function lobbyBusy(){
  const busy = !!pendingLobby || !lobbyConnected;
  const readyBtn = el<HTMLButtonElement>('online-ready');
  const startBtn = el<HTMLButtonElement>('online-start');
  if(busy){
   el('lobby').querySelectorAll<HTMLButtonElement>('#online-hero-picker button, #online-difficulty-picker button, #online-ready, #online-start').forEach(button => { button.disabled = true; });
   el('lobby-guidance').textContent = pendingLobby ? 'Ждём подтверждения…' : 'Ждём подключения…';
   if (pendingLobby) {
     if (readyBtn && !readyBtn.hidden) {
       setButtonProgress(readyBtn, { loading: true, determinate: false, loadingText: 'Ожидание…' });
     }
     if (startBtn && !startBtn.hidden) {
       setButtonProgress(startBtn, { loading: true, determinate: false, loadingText: 'Запуск…' });
     }
   }
  } else {
    if (readyBtn) setButtonProgress(readyBtn, { loading: false });
    if (startBtn) setButtonProgress(startBtn, { loading: false });
  }
  el('lobby').setAttribute('aria-busy', String(busy));
  el('lobby-guidance').classList.toggle('request-loading', busy);
 }
 function lobbyAction(type: string, extra: object, accepts: (next: Room) => boolean){
  if(pendingLobby || !lobbyConnected || ws?.readyState !== WebSocket.OPEN)return;
  el('online-error').textContent = '';
  pendingLobby = { accepts, timer: window.setTimeout(() => {
   clearLobbyPending();
   el('online-error').textContent = 'Нет подтверждения от сервера. Попробуйте ещё раз.';
   render();lobbyBusy();
  }, 12000) };
  transmit(type, extra);
  lobbyBusy();
 }
 let reconnectPoll: number | undefined, serverAnchor = 0, serverReceived = 0;
 function clearControls(){held.clear();el('online-duck').classList.remove('is-held');transmit('duck',{pressed:false})}
 function expireSession(){disconnect();el('room-entry').hidden=false;el('lobby').hidden=true;el('online-match').hidden=true;el('online-result').hidden=true;el('connection-status').textContent='Время возврата истекло';el('online-reconnect').hidden=false;el('online-reconnect').textContent='Вы выбыли: время возврата истекло. Создайте новую комнату или введите код.';el('online-error').textContent='Вы выбыли после разрыва связи. Создайте новую комнату или введите код.';}
 function reconnectMessage(){
  const notice=el('online-reconnect');
  if(!room||!session)return;
  const now=serverAnchor ? serverAnchor+performance.now()-serverReceived : undefined;
  const mine=room.members.findIndex(member=>member.id===session!.id);
  if(mine<0||room.engine?.players[mine]?.eligible===false){expireSession();return;}
  const member=room.members[mine];
  if(!lobbyConnected){
   const deadline=member.reconnectDeadline;
   if(now&&deadline&&now>=deadline){expireSession();return;}
   el('connection-status').textContent=now&&deadline?`Игра продолжается · возврат: ${Math.max(0,Math.ceil((deadline-now)/1000))} с`:'Связь потеряна · игра продолжается · уточняем срок у сервера…';
  }else{
   const friends=room.members.map((m,i)=>!m.connected&&i!==mine ? `Игрок ${i+1}: ${room!.engine?.players[i]?.eligible===false?'время возврата истекло':now&&m.reconnectDeadline?`нет связи, ${Math.max(0,Math.ceil((m.reconnectDeadline-now)/1000))} с`:'нет связи'}`:'').filter(Boolean);
   el('connection-status').textContent=friends.join(' · ')||'Подключено';
  }
  notice.textContent=el('connection-status').textContent;notice.hidden=lobbyConnected&&room.members.every(m=>m.connected);
 }
 async function pollReconnect(){
  const current=session;if(!current||closed||lobbyConnected)return;
  try{const next=await api<Room>(`rooms/${current.code}/status`,{token:current.token});if(session!==current||closed||lobbyConnected)return;room=next;serverAnchor=next.serverTime??0;serverReceived=performance.now();reconnectMessage();}
  catch(error){if(session===current&&error instanceof RankingApiError&&[403,404,410].includes(error.status))expireSession();}
 }
 window.setInterval(reconnectMessage,250);

 function disconnect(){el('online-reconnect').hidden=true;window.clearInterval(reconnectPoll);el('online').classList.remove('is-match');root.classList.remove('is-online-playing');entryVersion++;window.clearTimeout(entryTimer);entryBusy(false);clearLobbyPending();lobbyConnected=false;closed=true;window.clearTimeout(retry);window.clearInterval(heartbeat);clearControls();transmit('leave');ws?.close();session=undefined;room=undefined;sessionStorage.removeItem('jump-room');canvases.clear();previousSignature='';qrCode='';}
 function connect(){if(!session||closed)return;const socket=ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/rooms/${session.code}/ws`,'jump-v2');
  ws.onopen=()=>{if(ws!==socket||closed)return;ws!.send(JSON.stringify({token:session!.token}));el('connection-status').textContent='Подключаемся к комнате…';window.clearInterval(heartbeat);heartbeat=window.setInterval(()=>transmit('ping'),15000)};
  ws.onmessage=e=>{if(ws!==socket||closed)return;const next=JSON.parse(e.data) as Room;
   if(!lobbyConnected)previousSignature='';
   lobbyConnected=true;window.clearTimeout(entryTimer);entryBusy(false);
   el('connection-status').textContent='Подключено';
   if(pendingLobby?.accepts(next))clearLobbyPending();
   window.clearInterval(reconnectPoll);serverAnchor=next.serverTime??0;serverReceived=performance.now();room=next;reconnectMessage();lastTick=next.engine?.tick??0;lastReceived=performance.now();render();lobbyBusy()};
  ws.onclose=e=>{if(ws!==socket||closed)return;window.clearInterval(heartbeat);clearControls();lobbyConnected=false;void pollReconnect();window.clearInterval(reconnectPoll);reconnectPoll=window.setInterval(()=>void pollReconnect(),1000);clearLobbyPending();render();lobbyBusy();if(e.code===1008){expireSession();return}if(!closed){reconnectMessage();retry=window.setTimeout(connect,1200)}};
  ws.onerror=()=>{if(ws!==socket||closed)return;el('connection-status').textContent='Нет связи с сервером'};
 }
 async function enter(path:string, action?: 'create' | 'join'){
  if(entering)return;
  disconnect();
  const version = entryVersion;
  entryBusy(true, action);
  el('online-error').textContent='';
  el('connection-status').textContent='Открываем путь…';
  try{
   const next = await api<Session>(path,{});
   if(version !== entryVersion)return;
   session=next;sessionStorage.setItem('jump-room',JSON.stringify(session));
   closed=false;finishedID='';
   entryTimer=window.setTimeout(()=>{
    disconnect();el('room-entry').hidden=false;
    el('connection-status').textContent='';
    el('online-error').textContent='Не удалось подключиться к комнате. Попробуйте ещё раз.';
    entryBusy(false);
   },12000);
   connect();
  }catch(err){
   if(version !== entryVersion)return;
   disconnect();el('room-entry').hidden=false;
   el('online-error').textContent=String(err);el('connection-status').textContent='';
   entryBusy(false);
  }
 }

 function render(){if(!room||!session)return;const me=room.members.findIndex(m=>m.id===session!.id);if(me<0){disconnect();el('room-entry').hidden=false;el('lobby').hidden=true;el('online-error').textContent='Время возвращения истекло. Войдите в новую комнату.';return}
  el('room-entry').hidden=true;const playing=room.phase==='playing';const finished=room.phase==='finished';const between=room.phase==='between';el('lobby').hidden=playing||finished||between;el('online-match').hidden=!playing;el('online-result').hidden=!finished;el('online-stage-clear').hidden=!between;
  el('online').classList.toggle('is-match',playing);root.classList.toggle('is-online-playing',playing);
  if(playing && (window.matchMedia('(orientation: portrait)').matches || window.innerHeight > window.innerWidth)){
    el('online-rotate-notice').hidden = false;
  } else if (!el('online').classList.contains('requires-landscape')) {
    el('online-rotate-notice').hidden = true;
  }
  el('invite-code').textContent=room.code;el('lobby-title').textContent=room.phase==='failed'?'Ещё одна попытка?':room.phase==='between'?`Впереди — мир ${room.engine!.level+2}`:'Выберите свою стихию';el('online-start').textContent=room.phase==='failed'?'Повторить уровень':room.phase==='between'?'Следующий уровень':'Начать игру';
  const host=room.host===session.id;
  const currentDiff: DifficultyKey=(room.difficulty as DifficultyKey)||'medium';
  const signature=room.code+room.phase+room.host+currentDiff+room.members.map(m=>`${m.id}:${m.hero}:${m.ready}:${m.connected}`).join('|');
  if(signature!==previousSignature){
   previousSignature=signature;
   if(qrCode!==room.code){qrCode=room.code;const targetWidth=el<HTMLCanvasElement>('room-qr').clientWidth||144;void renderElementalQR(el<HTMLCanvasElement>('room-qr'),`${location.origin}/?room=${room.code}`,{width:targetWidth,centerBadge:'room'}).catch(()=>{el('online-error').textContent='QR недоступен. Пригласите друзей по коду комнаты.';});}
   const choosing=room.phase==='lobby';
   el('online-hero-picker').hidden=!choosing;el('hero-choice-hint').hidden=!choosing;
   const diffPicker=el('online-difficulty-picker');
   if(diffPicker){
    diffPicker.hidden=!choosing;
    const hint=el('online-diff-hint');
    if(hint)hint.textContent=host?'Вы организатор · можете сменить сложность':'Выбирает организатор комнаты';
    diffPicker.querySelectorAll<HTMLButtonElement>('.online-diff-btn').forEach(btn=>{
     const isSel=btn.dataset.onlineDiff===currentDiff;
     btn.classList.toggle('is-active',isSel);
     btn.setAttribute('aria-pressed',String(isSel));
     btn.disabled=!host;
    });
   }
   el('room-count').textContent=`${room.members.length} / 4`;
   if(choosing){
     const unlocked = (()=>{ try { return localStorage.getItem('secret_heroes_unlocked')==='true'; } catch { return false; } })();
     const available = availableCharacters(unlocked);
     el('online-hero-picker').innerHTML=available.map(({hero,index:i})=>`<button type="button" class="online-hero-card ${room!.members[me].hero===i?'is-selected':''}" data-online-hero="${i}" aria-pressed="${room!.members[me].hero===i}" aria-label="Выбрать: ${hero.name}, ${hero.element}" style="--hero-color:${hero.color}"><span class="hero-card-element" aria-hidden="true">${hero.symbol}</span>${portraitMarkup(hero)}<strong>${hero.name}</strong><span class="hero-card-element-name">${hero.element}</span><span class="hero-card-pet">${petMarkup(hero)}<small>${hero.petName}</small></span><span class="hero-card-choice">${room!.members[me].hero===i?'✓ Ваш герой':'Выбрать'}</span></button>`).join('');
   }
   el('online-members').replaceChildren();
   for(let i=0;i<4;i++){
    const member=room.members[i],card=document.createElement('div');card.className=`online-member ${member?.id===session.id?'is-you':''} ${member?.ready?'is-ready':''} ${!member?'is-empty':''}`;
    if(member){card.innerHTML=portraitMarkup(CHARACTERS[member.hero]);const info=document.createElement('div');const name=document.createElement('strong');name.textContent=`${member.id===session.id?'Вы':`Игрок ${i+1}`} · ${CHARACTERS[member.hero].name}`;const status=document.createElement('span');status.textContent=room.engine?.players[i]?.eligible===false?'Выбыл':!member.connected?'Нет связи':member.ready?'✓ Готов':'Пока не готов';info.append(name,status);card.append(info);}else{const empty=document.createElement('span');empty.className='empty-player-rune';empty.textContent='◇';const text=document.createElement('span');text.textContent='Ждём друга';card.append(empty,text);}
    el('online-members').append(card);
   }
   const mine=room.members[me],allReady=room.members.length>=2&&room.members.every((m,i)=>room!.engine?.players[i]?.eligible===false||m.ready&&m.connected);
   el<HTMLButtonElement>('online-ready').disabled=mine.ready||!mine.connected;el('online-ready').textContent=mine.ready?'✓ Вы готовы':'Я готов ✓';el('online-start').hidden=!host;el<HTMLButtonElement>('online-start').disabled=!allReady;
   el('lobby-guidance').textContent=room.members.length<2?'Позовите хотя бы одного друга':!allReady?'Когда все будут готовы, начнём приключение':host?'Команда в сборе. Можно отправляться!':'Команда готова. Ждём старта от создателя комнаты';
  }
  let defeat=el('online-local-defeat');
  if(!defeat){defeat=document.createElement('section');defeat.id='online-local-defeat';el('lobby').append(defeat);}
  defeat.hidden=room.phase!=='failed';
  if(room.phase==='failed'&&room.engine){
   const key=room.id+':'+room.engine.level+':'+room.engine.tick;
   if(defeat.dataset.key!==key){defeat.dataset.key=key;defeat.replaceChildren();const note=document.createElement('p');note.textContent='Поражение: результат можно сохранить только на этом устройстве. Повтор начнёт этап заново.';defeat.append(note);nameForms(defeat,key,session.token,room.engine.players,me,currentDiff,true);}
  }
  if (between && room.engine) {
    const nextLevel = room.engine.level + 1;
    const curWorld = WORLDS[room.engine.world];
    const nextWorldIndex = (room.engine.world + 1) % WORLDS.length;
    const nextWorld = WORLDS[nextWorldIndex];
    el('stage-clear-title').textContent = `Мир «${curWorld.name}» пройден!`;
    el('stage-clear-subtitle').textContent = `Этап ${room.engine.level + 1} из 3 позади. Очки сохранены!`;
    el('stage-next-world-name').textContent = `Этап ${nextLevel + 1} из 3 · ${nextWorld.name}`;

    const scoresWrap = el('stage-clear-scores');
    scoresWrap.replaceChildren();
    room.members.forEach((member, i) => {
      const p = room!.engine!.players[i];
      if (!p) return;
      const hero = CHARACTERS[p.hero];
      const card = document.createElement('div');
      card.className = `stage-score-card ${member.id === session!.id ? 'is-you' : ''}`;
      card.innerHTML = `
        ${portraitMarkup(hero)}
        <div class="stage-score-info">
          <strong>${member.id === session!.id ? 'Вы' : `Игрок ${i + 1}`} · ${hero.name}</strong>
          <small>${p.lives === 0 ? '👻 Призрак' : `${p.lives} ♥`}${member.ready ? ' · ✓ Готов' : ' · Ждёт'}</small>
          <b>${p.score} очков</b>
        </div>
      `;
      scoresWrap.append(card);
    });

    const mine = room.members[me];
    const allReady = room.members.length >= 2 && room.members.every((m, i) => room!.engine?.players[i]?.eligible === false || (m.ready && m.connected));
    const stageReadyBtn = el<HTMLButtonElement>('stage-clear-ready');
    stageReadyBtn.disabled = mine.ready || !mine.connected;
    stageReadyBtn.textContent = mine.ready ? '✓ Вы готовы' : 'Готов к следующему миру ✓';

    const stageStartBtn = el<HTMLButtonElement>('stage-clear-start');
    stageStartBtn.hidden = !host;
    stageStartBtn.disabled = !allReady;
    el('stage-clear-guidance').textContent = !allReady
      ? 'Ждём готовности остальных участников…'
      : host
        ? 'Все готовы! Создатель комнаты может начинать.'
        : 'Все готовы! Ждём старта от создателя комнаты.';
  }
  if(playing&&room.engine){
    const key=session.id+room.members.map(m=>m.id).join(',');
    if(el('own-lane').dataset.key!==key){
      el('own-lane').dataset.key=key;canvases.clear();el('own-lane').replaceChildren();el('opponent-lanes').replaceChildren();
      room.members.forEach((_,i)=>{
        const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=300;canvas.setAttribute('aria-label',`Дорожка игрока ${i+1}`);canvases.set(i,canvas);
        if(i===me){
          const hud=document.createElement('div');hud.className='online-hud';hud.id=`remote-label-${i}`;
          hud.innerHTML=`${portraitMarkup(CHARACTERS[room!.engine!.players[i].hero])}<div><strong></strong><span class="online-lives"></span></div><b>0<small>очков</small></b>`;
          const notice=document.createElement('div');notice.className='online-start-notice';notice.innerHTML='<strong></strong><span>Вперёд, вместе!</span>';
          el('own-lane').append(canvas,hud,notice);
        }else{
          const card=document.createElement('div');card.className='remote-lane';const label=document.createElement('p');label.id=`remote-label-${i}`;card.append(label,canvas);el('opponent-lanes').append(card);
        }
      });
    }
    const cfg=DIFFICULTIES[room.difficulty||'medium'];
    const remSec=Math.max(0,Math.ceil((cfg.levelSeconds*50-room.engine.tick)/50));
    const world=WORLDS[room.engine.world];
    el('online-clock').innerHTML=`<span class="lane-location">${room.engine.level+1}/3 · ${world.name}</span><span class="lane-timer">${String(Math.floor(remSec/60)).padStart(2,'0')}:${String(remSec%60).padStart(2,'0')}</span>`;
    room.engine.players.forEach((p,i)=>{
      const label=document.getElementById(`remote-label-${i}`);if(!label)return;
      const lives=p.lives===0?'👻 Призрак':'♥'.repeat(p.lives)+'♡'.repeat(Math.max(0,cfg.lives-p.lives));
      if(i===me){
        label.querySelector('strong')!.textContent=CHARACTERS[p.hero].name;
        label.querySelector('.online-lives')!.textContent=lives;
        label.querySelector('b')!.innerHTML=`${p.score}<small>очков</small>`;
        el('online-match').style.setProperty('--hero-color',CHARACTERS[p.hero].color);
        const notice=el('own-lane').querySelector<HTMLElement>('.online-start-notice')!;
        notice.hidden=room!.engine!.tick>80;notice.querySelector('strong')!.textContent=world.name;
      }else label.textContent=`${CHARACTERS[p.hero].name} · ${lives} · ${p.score}${p.connected?'':' · нет связи'}`;
    });
  }
  if(room.phase==='finished'&&room.engine&&finishedID!==room.id){
    finishedID=room.id;
    const target=el('online-result');
    target.replaceChildren();

    const allDead=room.engine.players.every(p=>p.lives===0);
    const maxScore=Math.max(...room.engine.players.map(p=>p.score),0);
    const diff=(room.difficulty as DifficultyKey)||'medium';

    const header=document.createElement('div');
    header.className='online-result-header';
    const title=document.createElement('h2');
    title.textContent=allDead?'Попытка не удалась':'Путешествие завершено!';
    const subtitle=document.createElement('p');
    subtitle.className='online-result-subtitle';
    subtitle.textContent=allDead
      ?'Все стихии пали в бою, но память о подвиге останется в летописи!'
      :'Все три этапа пройдены! Поздравляем всех героев!';
    header.append(title,subtitle);
    target.append(header);

    const scoreboard=document.createElement('div');
    scoreboard.className='online-scoreboard';
    scoreboard.setAttribute('aria-label','Итоговый счёт участников');
    room.engine.players.forEach((p,i)=>{
      const isYou=i===me;
   const hero=CHARACTERS[p.hero];
      const isWinner=p.score===maxScore&&p.score>0;
      const card=document.createElement('div');
      card.className=`online-score-card ${isYou?'is-you':''} ${isWinner?'is-winner':''}`;
      card.innerHTML=`
        <div class="score-card-hero">
          ${portraitMarkup(hero)}
          <div class="score-card-names">
            <strong>${isYou?'Вы':`Игрок ${i+1}`} · ${hero.name}</strong>
            <span class="score-card-status">${p.lives===0?'👻 Без сознания':`${p.lives} ♥`}${isWinner?' · 👑 Победитель':''}</span>
          </div>
        </div>
        <div class="score-card-points">
          <b>${p.score}</b>
          <small>очков</small>
        </div>
      `;
      scoreboard.append(card);
    });
    target.append(scoreboard);

    const myPlayer=room.engine.players[me];
    const myHero=CHARACTERS[myPlayer.hero];
    const ratingSection=document.createElement('div');
    ratingSection.className='online-my-rating';

    const myHeader=document.createElement('h3');
    myHeader.innerHTML=`Ваш результат: <b>${myPlayer.score}</b> очков (${myHero.name})`;

    const form=document.createElement('form');
    form.className='online-rating-form';
    const input=document.createElement('input');
    input.type='text';
    input.required=true;
    input.maxLength=20;
    input.placeholder='Ваше имя для рейтинга';
    input.setAttribute('autocomplete','nickname');
    input.setAttribute('aria-label','Ваше имя для рейтинга');

    const actions=document.createElement('div');
    actions.className='online-rating-actions';

    const submitBtn=document.createElement('button');
    submitBtn.type='submit';
    submitBtn.className='primary';
    submitBtn.textContent=allDead || myPlayer.eligible===false?'Сохранить на устройстве':'Записать в рейтинг';

    const skipBtn=document.createElement('button');
    skipBtn.type='button';
    skipBtn.className='secondary btn-skip-rating';
    skipBtn.textContent='Пропустить';

    const status=document.createElement('p');
    status.className='online-rating-status';
    status.setAttribute('role','status');

    actions.append(submitBtn,skipBtn);
    form.append(myHeader,input,actions,status);
    ratingSection.append(form);
    target.append(ratingSection);
    const recovery=document.createElement('div');target.append(recovery);mountRankingRecovery(recovery,api);

    skipBtn.onclick=()=>{
      openSkipConfirm(
        `Ваш счёт (${myPlayer.score} очков) не будет сохранён в рейтинге.`,
        ()=>{
          form.innerHTML='<p class="online-rating-skipped">Сохранение рейтинга пропущено.</p>';
        },
        ()=>{
          input.focus();
        }
      );
    };

    form.onsubmit=async e=>{
      e.preventDefault();
      const name=input.value.trim();
      if(!name)return;
      submitBtn.disabled=true;
      skipBtn.disabled=true;
      input.disabled=true;
      status.textContent='Сохраняем…';
      try{
        const res=await submitRankingResult(
          {
            id:room!.id,
            token:session?.token,
            player:me,
            name,
            score:myPlayer.score,
            difficulty:diff,
            deviceOnly: allDead || myPlayer.eligible === false,
          },
          api
        );
        status.textContent=rankingDeliveryMessage(res);
        if(res.ok && res.state==='pending') status.textContent='Запись принята на устройстве. Текущий статус отправки — ниже.';
        if(!res.ok)throw new Error(res.error??'Не удалось сохранить');
      }catch(err){
        status.textContent=String(err);
        submitBtn.disabled=false;
        skipBtn.disabled=false;
        input.disabled=false;
      }
    };

    const footer=document.createElement('div');
    footer.className='online-result-footer';
    const menuBtn=document.createElement('button');
    menuBtn.className='primary back-home';
    menuBtn.textContent='В главное меню ←';
    menuBtn.onclick=()=>{
      disconnect();
      show('home');
    };
    footer.append(menuBtn);
    target.append(footer);
  }
 }
 const audioState=new Map<number,{score:number;lives:number;jumps:number;readyAt:number;y:number;duck:boolean;fallUntil:number}>();
 const collectedAudio=new Set<string>();
 let audioRound='';
 function draw(now:number){
  gameAudio.onlineActive=!el('online').hidden&&room?.phase==='playing';
  requestAnimationFrame(draw);
  if(el('online').hidden||room?.phase!=='playing'||!room.engine)return;
  const engine=room.engine,cfg=DIFFICULTIES[room.difficulty||'medium'];
  const level=engine.world,speed=WORLDS[level].speed*cfg.speedMultiplier;
  const extrapolation=Math.min((now-lastReceived)/1000,.06),time=engine.tick*.02+extrapolation;
  const ownIndex=room.members.findIndex(m=>m.id===session?.id);
  gameAudio.world=engine.world;
  const round=room.id+':'+engine.level;
  if(round!==audioRound){audioState.clear();collectedAudio.clear();audioRound=round;}
  engine.players.forEach((p,i)=>{
    const previous=audioState.get(i);
    if(previous){
      if((p.fallUntil??0)>previous.fallUntil)gameAudio.effect('fall');
      else if(p.lives<previous.lives)gameAudio.effect('hit');
      if(p.duck&&!previous.duck)gameAudio.effect('duck',CHARACTERS[p.hero].key);
      if((p.jumps??0)>previous.jumps)gameAudio.effect('jump',CHARACTERS[p.hero].key);
      if((p.readyAt??0)>previous.readyAt)gameAudio.effect('cast',CHARACTERS[p.hero].key);
    }
    audioState.set(i,{score:p.score,lives:p.lives,jumps:p.jumps??0,readyAt:p.readyAt??0,y:p.y,duck:p.duck,fallUntil:p.fallUntil??0});
  });
  for(const item of engine.items){if(item.kind!=='bonus'||!item.passed||item.x<120)continue;const key=`${item.player}:${item.at}:${item.offset??0}`;if(!collectedAudio.has(key)){collectedAudio.add(key);gameAudio.effect('bonus');}}
  for(const [i,canvas] of canvases){
   const p=engine.players[i];if(!p)continue;
   const height=i===ownIndex?Math.max(120,Math.round(1100*canvas.parentElement!.clientHeight/Math.max(1,canvas.parentElement!.clientWidth))):300;
   if(canvas.height!==height)canvas.height=height;
   const c=canvas.getContext('2d')!,floor=height*.92,zoom=floor/276;
   c.clearRect(0,0,1100,height);
   c.fillStyle=['#271a20','#4d1b12','#0c1026','#384633','#b77e40'][level];c.fillRect(0,0,1100,height);
   const panorama=loadImage(`/art/level-${level+1}-bg.png`),surface=[570,540,575,535,518][level];
   const tileWidth=1100*zoom;
   const tile=(image:HTMLImageElement,sourceY:number,sourceHeight:number,y:number,h:number,offset:number)=>{
     if(!image.complete||!image.naturalWidth)return;
     const shift=offset%(tileWidth*2);
     for(let n=-1;n<Math.ceil(1100/tileWidth)+2;n++){
       c.save();c.translate(n*tileWidth-shift+(n%2!==0?tileWidth:0),0);c.scale(n%2!==0?-1:1,1);
       c.drawImage(image,0,sourceY,image.naturalWidth,sourceHeight,0,y,tileWidth,h);c.restore();
     }
   };
   const departure=level===0?180*(1-Math.pow(1-Math.min(1,time/2.5),3)):0;
   tile(panorama,0,surface,0,floor,time*3+departure);
   if(level===0){
     const ground=loadImage('/art/level-1-floor.png');
     if(ground.complete&&ground.naturalWidth){const scale=tileWidth/ground.naturalWidth;tile(ground,0,ground.naturalHeight,floor-320*scale,ground.naturalHeight*scale,time*speed);}
   }else if(panorama.complete&&panorama.naturalWidth){tile(panorama,surface,panorama.naturalHeight-surface,floor,(panorama.naturalHeight-surface)*floor/surface,time*speed);}
   // Keep horizontal travel in world units; scale each drawing about its foot point.
   const at=(x:number,lift:number,paint:()=>void)=>{c.save();c.translate(x,floor+lift*zoom);c.scale(zoom,zoom);paint();c.restore();};
   const drawCue=(x:number,glyph:string,lift:number)=>at(x,lift,()=>{
     c.font='bold 42px sans-serif';c.textAlign='center';c.strokeStyle='#15303f';c.lineWidth=5;c.strokeText(glyph,0,0);c.fillStyle='#fff1cf';c.fillText(glyph,0,0);
   });
   for(const o of engine.items){
    if(o.player!==i||o.passed&&o.kind==='bonus')continue;
    const x=o.x-speed*extrapolation;
    if(o.kind==='bonus'){
      const baseLift=-(o.height??(o.obstacle==='overhead'?32:o.obstacle==='none'?170:112));
      const phase=((o.at??0)+(o.offset??0))*0.01;
      const bob=getBonusFloatOffset(now,phase);
      const lift=baseLift+bob;
      const frame=getBonusFrameIndex(now,Math.floor(phase*100));
      at(x,lift,()=>{
        c.save();
        c.globalAlpha=getBonusGlowAlpha(now,phase)*0.85;
        const grad=c.createRadialGradient(0,-18,0,0,-18,24);
        grad.addColorStop(0,'rgba(255,225,120,0.7)');
        grad.addColorStop(0.5,'rgba(255,200,80,0.25)');
        grad.addColorStop(1,'rgba(255,180,50,0)');
        c.fillStyle=grad;
        c.fillRect(-24,-42,48,48);
        c.restore();

        c.save();
        if(frame===1) c.scale(0.92,1.0);
        if(level>=3){
          const image=loadImage(`/assets/bonuses/world-${level}.png`);
          if(image.complete&&image.naturalWidth)c.drawImage(image,-18,-36,36,36);
        }else{
          c.font='28px sans-serif';
          c.fillText(WORLDS[level].bonus,-14,0);
        }
        if(frame===2) drawSparkleStar(c,10,-30,7,2.5);
        c.restore();
      });
      if(level===0&&o.obstacle==='none')drawCue(x,'⇈',-198);
    }else if(['platform','gap','puddle','fire'].includes(o.kind)){
      at(x,-(o.height??0),()=>drawTerrain(c,o.kind,o.width??260,Math.floor(engine.tick*20/125)+obstaclePhase(o.at??0,o.offset)));
    }else{
      const key=obstacleAnimationKey(level,o.kind,o.obstacle,o.variant,o.at??0,ENEMIES[level][o.variant%2].key);
      const animation=OBSTACLE_ANIMATIONS[key];
      const elapsed=engine.tick*20;
      // Go snapshots encode living objects with defeatedAt: 0.
      const defeatedAt=o.kind==='enemy'&&(o.defeatedAt??0)>0?o.defeatedAt:undefined;
      const frame=obstacleFrameRect(animation,obstacleFrame(animation,elapsed,obstaclePhase(o.at??0,o.offset),defeatedAt));
      at(x,0,()=>{
        const image=loadImage(animation.path);
        const age=defeatedAt===undefined?0:elapsed-defeatedAt;
        c.globalAlpha=age<480?1:Math.max(0,1-(age-480)/200);
        if(image.complete&&image.naturalWidth)c.drawImage(image,frame.x,frame.y,frame.width,frame.height,-animation.originX*animation.scale,-animation.originY*animation.scale,frame.width*animation.scale,frame.height*animation.scale);
      });
      if(level===0&&o.kind==='obstacle')drawCue(x,o.obstacle==='overhead'?'↓':'↑',o.obstacle==='overhead'?-160:-90);
    }
   }
   const hero=CHARACTERS[p.hero];
   const gameTime=engine.tick*20;
   let v2=senseiAnimations.get(i);
   if((hero.key==='sensei'||hero.key==='stella')){
     if(!v2||gameTime===0){v2={animation:hero.key==='stella'?new StellaAnimation(actionRandom(i+engine.level*131)):new AnimationV2(actionRandom(i+engine.level*131)),jumps:0,duck:false,ready:0,lives:p.lives,hurtUntil:0};senseiAnimations.set(i,v2);}
     if((p.jumps??0)>v2.jumps)v2.animation.beginJump((p.jumps??0)>=2);
     if(p.duck&&!v2.duck)v2.animation.beginSlide();
     if((p.readyAt??0)!==v2.ready){v2.animation.spell=chooseSpell(actionRandom((p.readyAt??0)+i*7919));v2.animation.cast((p.readyAt??0)-500);if(v2.animation instanceof StellaAnimation)v2.animation.stellaSpell=chooseStellaSpell(actionRandom((p.readyAt??0)+i*7919));v2.ready=p.readyAt??0;}
     if(p.lives<v2.lives)v2.hurtUntil=gameTime+650;
     v2.jumps=p.jumps??0;v2.duck=p.duck;v2.lives=p.lives;
   }else v2=undefined;
   const spellKey=v2?.animation instanceof StellaAnimation?`stella-${v2.animation.stellaSpell}`:v2?`sensei-${v2.animation.spell}`:hero.key;
   for(const shot of engine.projectiles??[])if(shot.player===i)at(shot.x+700*extrapolation,shot.y??-30,()=>{const image=loadImage(`/assets/spells/${spellKey}.png`);if(image.complete&&image.naturalWidth){c.shadowColor=hero.color;c.shadowBlur=12;c.drawImage(image,Math.floor(engine.tick/4)%4*128,0,128,96,-45,-34,90,68);}else drawSpell(c,0,0,hero.key,now/200);});
   if(i===ownIndex){
     const leftCast=Math.max(0,(p.readyAt??0)-engine.tick*20);
     const castBtn=el<HTMLButtonElement>('online-cast');
     if(castBtn){castBtn.disabled=leftCast>0;castBtn.setAttribute('aria-label',SPELLS[hero.key].name);castBtn.querySelector('small')!.textContent=leftCast>0?(leftCast/1000).toFixed(1)+' с':'Готово';castBtn.style.setProperty('--charge',`${(1-leftCast/500)*100}%`);}
     const leftDash=Math.max(0,(p.readyDashAt??0)-engine.tick*20);
     const dashBtn=el<HTMLButtonElement>('online-dash');
     if(dashBtn){dashBtn.disabled=leftDash>0;dashBtn.querySelector('small')!.textContent=leftDash>0?(leftDash/1000).toFixed(1)+' с':'Готово';dashBtn.style.setProperty('--charge',`${(1-leftDash/2000)*100}%`);}
     el('online-duck').classList.toggle('is-held',p.duck);
   }
   const atlas=hero.key==='stella'?'atlas-v2':hero.clean?'atlas-elemental':'atlas';
   let frameName=`run-${String(Math.floor(now/(85/cfg.speedMultiplier))%hero.run).padStart(2,'0')}`;
   if(!p.grounded&&p.y!==0){const flipCount=(hero.key==='kai'||hero.key==='leya')?6:4;frameName=(p.jumps||0)>=2?`flip-${String(Math.floor(now/80)%flipCount).padStart(2,'0')}`:p.velocity< -150?'jump-00':p.velocity<150?'jump-01':'jump-02';}
   else if(p.duck)frameName=`duck-${String(hero.duck-1).padStart(2,'0')}`;
   if(v2)frameName=v2.animation.frame(gameTime,{hurt:gameTime<v2.hurtUntil,airborne:!p.grounded&&p.y!==0,double:(p.jumps??0)>=2,duck:p.duck,velocity:p.velocity});
   const frame=atlases.get(hero.key)?.[frameName]?.frame,image=loadImage(`/assets/characters/${hero.key}/${atlas}.png`);
   at(160,Math.min(0,p.y+p.velocity*extrapolation+950*extrapolation*extrapolation),()=>{
     if(p.lives===0){c.globalAlpha=.68;c.filter='drop-shadow(0 0 8px #00ffff) hue-rotate(155deg)';}
     const size=256*hero.scale;if(frame&&image.complete&&image.naturalWidth)c.drawImage(image,frame.x,frame.y,frame.w,frame.h,-size/2,-size*240/256,size,size);
   });
   const pet=loadImage(`/assets/pets/${v2?hero.pet:hero.petRest}.png`);at(56,0,()=>{if(pet.complete&&pet.naturalWidth){if(v2){const reacting=(v2.animation instanceof StellaAnimation&&v2.animation.stellaSpell==='burst'&&gameTime-v2.animation.castAt<1000)||gameTime<v2.hurtUntil||(v2.animation.spell==='harmony'&&gameTime-v2.animation.castAt<650);const frame=hero.key==='stella'?(reacting?9+Math.floor(gameTime/125)%5:4+Math.floor(gameTime/100)%5):reacting?7+Math.floor(gameTime/125)%4:2+Math.floor(gameTime/100)%5;c.drawImage(pet,frame*128,0,128,128,-42,-73,83,83);}else c.drawImage(pet,-42,-73,83,83);}});
  }
 }
 requestAnimationFrame(draw);
 el('create-room').onclick=()=>void enter('rooms', 'create');el('join-room').onsubmit=e=>{e.preventDefault();void enter(`rooms/${el<HTMLInputElement>('room-code').value}/join`, 'join')};
 el('online-difficulty-picker').onclick=e=>{const card=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-online-diff]');if(card&&!card.disabled&&card.dataset.onlineDiff)lobbyAction('difficulty',{difficulty:card.dataset.onlineDiff},next=>next.difficulty===card.dataset.onlineDiff);};
 el('online-hero-picker').onclick=e=>{const card=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-online-hero]');if(card&&!card.disabled)lobbyAction('hero',{hero:Number(card.dataset.onlineHero)},next=>next.members.find(member=>member.id===session?.id)?.hero===Number(card.dataset.onlineHero))};
 function checkPhoneOrientationForReady(): boolean {
   const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight > window.innerWidth;
   const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
   if (isPortrait && isTouch) {
     el('online').classList.add('requires-landscape');
     el('online-rotate-notice').hidden = false;
     el('lobby-guidance').textContent = 'Пожалуйста, поверните телефон горизонтально перед готовностью!';
     return false;
   }
   el('online').classList.remove('requires-landscape');
   el('online-rotate-notice').hidden = true;
   return true;
 }
 function updateOrientationState() {
   const isLandscape = window.innerWidth >= window.innerHeight;
   if (isLandscape) {
     el('online').classList.remove('requires-landscape');
     el('online-rotate-notice').hidden = true;
   } else if (room?.phase === 'playing') {
     el('online-rotate-notice').hidden = false;
   }
 }
 window.addEventListener('resize', updateOrientationState);
 window.addEventListener('orientationchange', updateOrientationState);
 el('online-ready').onclick=()=>{
   if(!checkPhoneOrientationForReady()) return;
   lobbyAction('ready',{},next=>next.members.find(member=>member.id===session?.id)?.ready===true);
 };
 el('online-start').onclick=()=>{const phase=room?.phase;lobbyAction('start',{},next=>next.phase!==phase)};
 el('stage-clear-ready').onclick=()=>{
   if(!checkPhoneOrientationForReady()) return;
   lobbyAction('ready',{},next=>next.members.find(member=>member.id===session?.id)?.ready===true);
 };
 el('stage-clear-start').onclick=()=>{const phase=room?.phase;lobbyAction('start',{},next=>next.phase!==phase)};
 el('online-back').onclick=()=>{disconnect();show('home')};
 el('copy-invite').onclick=()=>{if(room)void navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`).then(()=>{el('connection-status').textContent='Приглашение скопировано'}).catch(()=>{el('online-error').textContent=`${location.origin}/?room=${room!.code}`})};
 const held=new Set<string>();const release=(source:string)=>{held.delete(source);if(!held.size)transmit('duck',{pressed:false})};
 el('online-cast').onpointerdown=e=>{e.preventDefault();transmit('cast')};
 el('online-dash').onpointerdown=e=>{e.preventDefault();transmit('dash')};
 el('online-jump').onpointerdown=e=>{e.preventDefault();transmit('jump')};const duck=el('online-duck');duck.onpointerdown=e=>{e.preventDefault();duck.setPointerCapture(e.pointerId);held.add(`p${e.pointerId}`);transmit('duck',{pressed:true})};for(const type of ['pointerup','pointercancel','lostpointercapture'])duck.addEventListener(type,e=>release(`p${(e as PointerEvent).pointerId}`));
 window.addEventListener('keydown',e=>{if(el('online').hidden||room?.phase!=='playing')return;if(['KeyW','ArrowUp','KeyS','ArrowDown','KeyD','ArrowRight','KeyA','ArrowLeft','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;if(['KeyA','ArrowLeft'].includes(e.code))transmit('cast');if(['KeyD','ArrowRight'].includes(e.code))transmit('dash');if(['KeyW','ArrowUp','Space'].includes(e.code))transmit('jump');if(['KeyS','ArrowDown'].includes(e.code)){held.add(e.code);transmit('duck',{pressed:true})}});window.addEventListener('keyup',e=>{if(['KeyS','ArrowDown'].includes(e.code))release(e.code)});window.addEventListener('blur',()=>{held.clear();clearControls()});document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();clearControls()}});
 const recovery=document.createElement('section'); recovery.className='ranking-recovery'; el('ranking').append(recovery); mountRankingRecovery(recovery,api);
 let currentRankingDiff: DifficultyKey = 'medium';
 let rankingLoading = false;
 let rankingSeq = 0;

 function renderRankingRows(entries: {name: string; score: number; provenance?: string}[], target: HTMLElement){
  target.replaceChildren();
  entries.slice(0, TOP_RANKING_LIMIT).forEach((row, i) => {
   const li = document.createElement('li'), rank = i + 1;
   li.className = `ranking-row ${rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other'}`;
   li.style.setProperty('--row-idx', String(i));
   const badge = document.createElement('span'); badge.className = 'rank-badge';
   badge.textContent = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
   const name = document.createElement('span'); name.className = 'rank-name'; name.textContent = row.name;
   const provenance = document.createElement('small'); provenance.className = 'provenance-badge';
   provenance.textContent = 'provenance' in row && row.provenance === 'verified' ? '✓ Подтверждён сервером' : 'Офлайн · без проверки';
   name.append(provenance);
   const score = document.createElement('strong'); score.className = 'rank-score';
   score.innerHTML = `${row.score} <small>очков</small>`;
   li.append(badge, name, score);
   target.append(li);
  });
 }

 async function animateRankingExit(list: HTMLElement, status: HTMLElement): Promise<void> {
  const rows = Array.from(list.children) as HTMLElement[];
  const hasStatusContent = status.children.length > 0 || Boolean(status.textContent?.trim());
  if (!rows.length && !hasStatusContent) {
   return;
  }
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReduced) {
   list.replaceChildren();
   status.replaceChildren();
   status.textContent = '';
   status.className = 'ranking-status';
   return;
  }
  rows.forEach((row, i) => {
   row.classList.add('is-exiting');
   row.style.setProperty('--exit-idx', String(Math.min(i, 8)));
  });
  if (hasStatusContent) {
   status.classList.add('is-exiting');
  }
  await new Promise(r => setTimeout(r, 180));
  list.replaceChildren();
  status.replaceChildren();
  status.textContent = '';
  status.classList.remove('is-exiting');
  status.className = 'ranking-status';
 }

 async function ranking(diff: DifficultyKey = currentRankingDiff, force = false){
  if(rankingLoading && !force)return;
  rankingLoading = true;
  const seq = ++rankingSeq;
  const tabs = document.querySelectorAll<HTMLButtonElement>('.ranking-tab');
  const reload = el<HTMLButtonElement>('ranking-reload');
  const status = el('ranking-status'), list = el('ranking-list'), weekEl = el('ranking-week');
  const content = el<HTMLElement>('ranking-content') || list.parentElement;

  tabs.forEach(tab => { tab.disabled = true; });
  reload.disabled = true;
  reload.classList.add('is-spinning');
  list.setAttribute('aria-busy', 'true');
  currentRankingDiff = diff;

  tabs.forEach(tab => {
   const isSel = tab.dataset.diff === diff;
   tab.classList.toggle('is-active', isSel);
   tab.setAttribute('aria-selected', String(isSel));
  });

  if (content) {
   const currentH = content.offsetHeight;
   if (currentH > 0) {
    content.style.minHeight = `${currentH}px`;
   }
  }
  weekEl.classList.add('is-updating');

  let fetchDone = false;
  const fetchPromise = (async () => {
   await syncPendingRankings(api).catch(error => console.error('Ranking storage', error));
   const res = await api<{week: string; difficulty: string; entries: {name: string; score: number; provenance: string}[]}>(`ranking?difficulty=${diff}`);
   fetchDone = true;
   return res;
  })();

  await animateRankingExit(list, status);
  if (seq !== rankingSeq) return;

  if (!fetchDone) {
   status.textContent = 'Связываемся с книгой рекордов…';
   status.className = 'ranking-status is-loading';
  }

  const cfg = DIFFICULTIES[diff] ?? DIFFICULTIES.medium;
  try{
   const data = await fetchPromise;
   if (seq !== rankingSeq) return;
   status.textContent = '';
   status.className = 'ranking-status';
   weekEl.textContent = `Турнирная неделя с ${data.week} · Топ 20 игроков сложности «${cfg.name}» (${cfg.levelSeconds} сек) · обновление в понедельник в 00:00 МСК`;
   weekEl.classList.remove('is-updating');
   if(!data.entries || !data.entries.length){
    status.className = 'ranking-status';
    status.innerHTML = `<div class="ranking-empty"><span class="empty-rune" aria-hidden="true">${cfg.icon}</span><strong>Свиток рекордов сложности «${cfg.name}» пока пуст!</strong><p>Турнир этой недели только начался. Пройдите три этапа и станьте первыми чемпионами недели на сложности «${cfg.name}»!</p></div>`;
    return;
   }
   renderRankingRows(data.entries, list);
  }catch{
   if (seq !== rankingSeq) return;
   try{
    const localList = getLocalRecords(diff);
    if(localList.length){
     weekEl.textContent = `Рекорды на этом устройстве (офлайн) · Топ 20 игроков сложности «${cfg.name}» (${cfg.levelSeconds} сек)`;
     weekEl.classList.remove('is-updating');
     status.textContent = '';
     status.className = 'ranking-status';
     renderRankingRows(localList, list);
     return;
    }
   }catch{}
   weekEl.classList.remove('is-updating');
   status.className = 'ranking-status is-error';
   status.innerHTML = '<div class="ranking-error"><span aria-hidden="true">📡</span><p>Нет связи с сервером рейтинга. Проверьте интернет и нажмите «Обновить».</p></div>';
  }finally{
   if (seq === rankingSeq) {
    rankingLoading = false;
    tabs.forEach(tab => { tab.disabled = false; });
    reload.disabled = false;
    reload.classList.remove('is-spinning');
    list.setAttribute('aria-busy', 'false');
    if (content) {
     content.style.minHeight = '';
    }
   }
  }
 }
 window.addEventListener('online',()=>void syncPendingRankings(api).catch(error=>console.error('Ranking storage',error)));
 void syncPendingRankings(api).catch(error=>console.error('Ranking storage',error));
 el('ranking-reload').onclick=()=>void ranking(currentRankingDiff, true);
 document.querySelectorAll<HTMLElement>('.ranking-tab').forEach(tab=>{
  tab.onclick=()=>{
   const diff = (tab.dataset.diff as DifficultyKey) || 'medium';
   if (diff === currentRankingDiff && !rankingLoading) return;
   void ranking(diff);
  };
 });
 el('ranking-back').onclick=()=>show('home');
 return {open:()=>{show('online');el('room-entry').hidden=false;el('lobby').hidden=true;el('online-match').hidden=true;el('online-result').hidden=true;const code=new URLSearchParams(location.search).get('room');if(code&&/^\d{4}$/.test(code))el<HTMLInputElement>('room-code').value=code;try{const saved=sessionStorage.getItem('jump-room');if(saved){session=JSON.parse(saved) as Session;closed=false;connect()}}catch{}},ranking:(diff: DifficultyKey = 'medium')=>{show('ranking');void ranking(diff)}};
}
export function drawArch(c:CanvasRenderingContext2D,x:number,floor:number,level:number){
 if(level>=3){
  if(level===4)return;
  c.save();c.translate(x,floor);c.fillStyle='#574b32';c.strokeStyle='#302c20';c.lineWidth=2;
  c.beginPath();c.moveTo(-77,-107);c.lineTo(-43,-113);c.lineTo(-12,-109);c.lineTo(25,-114);c.lineTo(77,-106);c.lineTo(74,-86);c.lineTo(30,-88);c.lineTo(-20,-83);c.lineTo(-76,-87);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#9c8750';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-69,-103+i*6);c.bezierCurveTo(-30,-111+i*7,25,-98+i*3,70,-102+i*6);c.stroke();}
  c.strokeStyle='#69824b';c.lineWidth=5;for(let i=-65;i<75;i+=19){c.beginPath();c.moveTo(i,-109);c.quadraticCurveTo(i-7,-95,i-3,-86+(i%3)*3);c.stroke();}c.restore();return;
 }

 c.fillStyle=['#765244','#dc83a6','#7186b4','#52643b','#ba824a'][level];c.fillRect(x+42,floor-112,14,112);c.fillRect(x-50,floor-112,106,36);
 if(level===0){c.fillStyle='#344e51';c.beginPath();c.moveTo(x-65,floor-112);c.quadraticCurveTo(x-35,floor-115,x-40,floor-128);c.quadraticCurveTo(x,floor-114,x+40,floor-128);c.quadraticCurveTo(x+35,floor-115,x+65,floor-112);c.closePath();c.fill();c.strokeStyle='#fff0d4';c.lineWidth=7;for(let dx=-40;dx<45;dx+=24){c.beginPath();c.moveTo(x+dx,floor-110);c.lineTo(x+dx+18,floor-78);c.stroke()}}
 if(level===1){c.fillStyle='#447853';for(let dx=-35;dx<45;dx+=25){c.beginPath();c.ellipse(x+dx,floor-116,24,11,-.4,0,Math.PI*2);c.fill()}}
 if(level===2){c.strokeStyle='#95f0f5';c.lineWidth=5;c.strokeRect(x-48,floor-110,101,32)}
}
