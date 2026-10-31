import { ENEMIES, SPELLS } from './combat';
import { drawSpell } from './combat-art';
import './online.css';
import { actionIcon, castButtonContent } from './game-controls';
import QRCode from 'qrcode';
import { CHARACTERS, portraitMarkup, petMarkup } from './characters';
import { WORLDS, DIFFICULTIES, type DifficultyKey } from './rules';
import { getLocalRecords, submitRankingResult, syncPendingRankings, openSkipConfirm, TOP_RANKING_LIMIT } from './ranking.ts';

export interface Action { tick:number; player:number; kind:'jump'|'duck'|'cast'; pressed:boolean }
export interface Attempt { id:string; token:string; seed:number; count:number; difficulty?:string }
export async function api<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(await response.text());return response.json() as Promise<T>;
}
export function nameForms(target:HTMLElement,id:string,token:string,players:{score:number;eligible?:boolean}[],only?:number,difficulty:DifficultyKey='medium'){
 const max=Math.max(...players.filter(p=>p.eligible!==false).map(p=>p.score));
 players.forEach((p,i)=>{if(p.score!==max||p.eligible===false||(only!==undefined&&only!==i))return;
  const form=document.createElement('form');form.className='winner-form';
  const label=document.createElement('label');label.textContent=`Победитель · Игрок ${i+1} · ${p.score} очков (${DIFFICULTIES[difficulty]?.name ?? 'Средний'})`;
  const input=document.createElement('input');input.required=true;input.maxLength=20;input.placeholder='Ваше имя';input.setAttribute('autocomplete','nickname');input.setAttribute('aria-label','Имя победителя');
  const button=document.createElement('button');button.textContent='Записать в рейтинг';button.className='primary';
  const status=document.createElement('p');status.setAttribute('role','status');form.append(label,input,button,status);target.append(form);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    button.disabled=true;
    try{
      await api('results',{id,token,player:i,name:input.value});
      status.textContent='Результат записан в рейтинг!';
      input.disabled=true;
      try{
        const raw=localStorage.getItem(`jump-records-${difficulty}`);
        const list:{name:string;score:number}[]=raw?JSON.parse(raw):[];
        list.push({name:input.value.trim(),score:p.score});
        list.sort((a,b)=>b.score-a.score);
        localStorage.setItem(`jump-records-${difficulty}`,JSON.stringify(list.slice(0,50)));
      }catch{}
    }catch(err){
      status.textContent=String(err);
      button.disabled=false;
    }
  });
 });
}
interface Body {readyAt?:number;lives:number;score:number;y:number;velocity:number;duck:boolean;hero:number;connected:boolean;eligible:boolean;jumps?:number}
interface Item {defeatedAt?:number;x:number;player:number;passed:boolean;kind:string;obstacle:string;variant:number}
interface Room {code:string;id:string;host:string;phase:string;difficulty?:DifficultyKey;members:{id:string;hero:number;ready:boolean;connected:boolean}[];engine?:{tick:number;level:number;world:number;players:Body[];items:Item[];projectiles?:{x:number;distance:number;player:number}[]}}
interface Session {code:string;id:string;token:string}
export function mountNetwork(show:(id:string)=>void){
 const root=document.querySelector('.mobile-app')!;
 root.insertAdjacentHTML('beforeend',`
 <section id="online" class="screen online-screen" hidden>
  <header class="online-header"><button id="online-back" class="icon-button" aria-label="Вернуться в меню">←</button><span class="online-wordmark">МАГИ СТИХИЙ <i>◇</i> ОДНО ПРИКЛЮЧЕНИЕ</span><span id="connection-status" class="connection-status" role="status"></span></header>
  <div id="room-entry" class="room-entry">
   <div class="online-intro"><span class="eyebrow">ВОЛШЕБНЫЙ ПРЫЖОК · ОНЛАЙН</span><h2>Друзья, <em>в путь!</em></h2><p>Соберите команду и отправляйтесь навстречу пяти мирам.</p></div>
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
    <aside class="room-invite"><span class="eyebrow">ПРИГЛАСИТЕ ДРУЗЕЙ</span><span class="invite-caption">Код вашей комнаты</span><strong id="invite-code"></strong><div class="qr-frame"><canvas id="room-qr" aria-label="QR-код приглашения"></canvas></div><span class="invite-note">Введите код или отсканируйте QR</span><button id="copy-invite" class="secondary">Скопировать приглашение ↗</button></aside>
    <div class="online-party"><div class="online-party-heading"><div><span class="eyebrow">СОБЕРИТЕ СВОЮ КОМАНДУ</span><h2 id="lobby-title">Выберите свою стихию</h2></div><span id="room-count" class="room-count"></span></div><div id="online-difficulty-picker" class="online-difficulty-picker" role="group" aria-label="Сложность игры"><div class="difficulty-picker-header"><span class="difficulty-picker-label">Сложность приключения</span><span id="online-diff-hint" class="online-diff-hint"></span></div><div class="online-difficulty-tabs"><button type="button" class="online-diff-btn" data-online-diff="easy"><span class="diff-icon">🌸</span><strong>Лёгкий</strong><small>20 сек · 4 жизни</small></button><button type="button" class="online-diff-btn is-active" data-online-diff="medium"><span class="diff-icon">⭐</span><strong>Средний</strong><small>40 сек · 3 жизни</small></button><button type="button" class="online-diff-btn" data-online-diff="hard"><span class="diff-icon">🔥</span><strong>Сложный</strong><small>50 сек · 3 жизни</small></button></div></div><p id="hero-choice-hint" class="hero-choice-hint">Выбирайте любого героя — даже если друг уже играет им.</p><div id="online-hero-picker" class="online-hero-picker" role="group" aria-label="Выбор персонажа"></div><div id="online-members" aria-label="Участники комнаты"></div><footer class="lobby-actions"><p id="lobby-guidance" role="status"></p><button id="online-ready" class="primary">Я готов <span aria-hidden="true">✓</span></button><button id="online-start" class="primary">Начать игру <span aria-hidden="true">→</span></button></footer></div>
   </div>
  </div>
  <div id="online-match" hidden><div id="online-clock"></div><div id="opponent-lanes" aria-label="Экраны друзей"></div><div id="own-lane"></div><div class="online-controls" aria-label="Управление вашим героем"><button id="online-jump" aria-label="Прыжок">${actionIcon('jump')}<strong>Прыжок</strong><kbd>W / ↑</kbd></button><button id="online-cast" class="cast-control" aria-label="Заклинание">${castButtonContent('D / →')}</button><button id="online-cast-mirror" class="cast-control" aria-label="Заклинание">${castButtonContent('D / →')}</button><button id="online-duck" aria-label="Присесть, удерживайте">${actionIcon('duck')}<strong>Присесть</strong><kbd>S / ↓</kbd></button></div></div>
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
  <div class="ranking-content"><p id="ranking-status" role="status" class="ranking-status"></p><ol id="ranking-list" class="ranking-list"></ol></div>
  <div class="ranking-rules-card"><div class="rules-card-icon" aria-hidden="true">🏆</div><div><strong>Как попасть на Доску почёта?</strong><p>Пройдите все 5 миров на выбранной сложности. Берегите сердечки, ловите сладкие бонусы и впишите имя команды в золотой свиток!</p></div></div>
  <div class="ranking-footer-actions"><button class="primary back-home">В главное меню ←</button></div>
 </section>`);
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 let session:Session|undefined,ws:WebSocket|undefined,room:Room|undefined,closed=true,retry:number|undefined,heartbeat:number|undefined,finishedID='',previousSignature='',qrCode='';
 let lastTick=0,lastReceived=0;const canvases=new Map<number,HTMLCanvasElement>();
 const images=new Map<string,HTMLImageElement>();const atlases=new Map<string,Record<string,{frame:{x:number;y:number;w:number;h:number}}>>();
 function loadImage(path:string){let image=images.get(path);if(!image){image=new Image();image.src=path;images.set(path,image)}return image}
 for(const hero of CHARACTERS){const atlas=hero.clean?'atlas-elemental':'atlas';loadImage(`/assets/characters/${hero.key}/${atlas}.png`);void fetch(`/assets/characters/${hero.key}/${atlas}.json`).then(r=>r.json()).then(data=>atlases.set(hero.key,data.frames)).catch(()=>{});loadImage(`/assets/pets/${hero.petRest}.png`)}
 for(const key of ['rock','stakes','log'])loadImage(`/assets/obstacles/${key}.png`);
 function transmit(type:string,extra:object={}){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type,...extra}));if(type==='jump'&&room?.phase==='playing'&&room.engine){const me=room.members.findIndex(m=>m.id===session?.id);const p=room.engine.players[me];if(p&&!p.duck){if(p.y===0){p.velocity=-612;p.y=-12.24;p.jumps=1;}else if((p.jumps||0)<2){p.velocity=-612;p.jumps=2;}}}}}
 let entering = false, entryVersion = 0, entryTimer: number | undefined;
 let pendingLobby: { accepts: (next: Room) => boolean; timer: number } | undefined;
 let lobbyConnected = false;
 function entryBusy(busy: boolean){
  entering = busy;
  el<HTMLButtonElement>('create-room').disabled = busy;
  el<HTMLButtonElement>('room-code').disabled = busy;
  el<HTMLFormElement>('join-room').querySelector('button')!.disabled = busy;
  el('room-entry').setAttribute('aria-busy', String(busy));
  el('connection-status').classList.toggle('request-loading', busy);
 }
 function clearLobbyPending(){
  if(pendingLobby)window.clearTimeout(pendingLobby.timer);
  pendingLobby = undefined;
  previousSignature = '';
 }
 function lobbyBusy(){
  const busy = !!pendingLobby || !lobbyConnected;
  if(busy){
   el('lobby').querySelectorAll<HTMLButtonElement>('#online-hero-picker button, #online-difficulty-picker button, #online-ready, #online-start').forEach(button => { button.disabled = true; });
   el('lobby-guidance').textContent = pendingLobby ? 'Ждём подтверждения…' : 'Ждём подключения…';
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
 function clearControls(){transmit('duck',{pressed:false})}
 function disconnect(){el('online').classList.remove('is-match');root.classList.remove('is-online-playing');entryVersion++;window.clearTimeout(entryTimer);entryBusy(false);clearLobbyPending();lobbyConnected=false;closed=true;window.clearTimeout(retry);window.clearInterval(heartbeat);clearControls();transmit('leave');ws?.close();session=undefined;room=undefined;sessionStorage.removeItem('jump-room');canvases.clear();previousSignature='';qrCode='';}
 function connect(){if(!session||closed)return;const socket=ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/rooms/${session.code}/ws`,'jump-v1');
  ws.onopen=()=>{if(ws!==socket||closed)return;ws!.send(JSON.stringify({token:session!.token}));el('connection-status').textContent='Подключаемся к комнате…';window.clearInterval(heartbeat);heartbeat=window.setInterval(()=>transmit('ping'),15000)};
  ws.onmessage=e=>{if(ws!==socket||closed)return;const next=JSON.parse(e.data) as Room;
   if(!lobbyConnected)previousSignature='';
   lobbyConnected=true;window.clearTimeout(entryTimer);entryBusy(false);
   el('connection-status').textContent='Подключено';
   if(pendingLobby?.accepts(next))clearLobbyPending();
   room=next;lastTick=next.engine?.tick??0;lastReceived=performance.now();render();lobbyBusy()};
  ws.onclose=e=>{if(ws!==socket||closed)return;window.clearInterval(heartbeat);lobbyConnected=false;clearLobbyPending();render();lobbyBusy();if(e.code===1008){disconnect();el('room-entry').hidden=false;el('lobby').hidden=true;el('online-match').hidden=true;el('online-error').textContent='Сессия истекла. Создайте новую комнату или введите код.';return}if(!closed){el('connection-status').textContent='Связь потеряна · подключаемся…';retry=window.setTimeout(connect,1200)}};
  ws.onerror=()=>{if(ws!==socket||closed)return;el('connection-status').textContent='Нет связи с сервером'};
 }
 async function enter(path:string){
  if(entering)return;
  disconnect();
  const version = entryVersion;
  entryBusy(true);
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
   },12000);
   connect();
  }catch(err){
   if(version !== entryVersion)return;
   disconnect();el('room-entry').hidden=false;
   el('online-error').textContent=String(err);el('connection-status').textContent='';
  }
 }

 function render(){if(!room||!session)return;const me=room.members.findIndex(m=>m.id===session!.id);if(me<0){disconnect();el('room-entry').hidden=false;el('lobby').hidden=true;el('online-error').textContent='Время возвращения истекло. Войдите в новую комнату.';return}
  el('room-entry').hidden=true;const playing=room.phase==='playing';el('lobby').hidden=playing||room.phase==='finished';el('online-match').hidden=!playing;el('online-result').hidden=room.phase!=='finished';
  el('online').classList.toggle('is-match',playing);root.classList.toggle('is-online-playing',playing);
  el('invite-code').textContent=room.code;el('lobby-title').textContent=room.phase==='failed'?'Ещё одна попытка?':room.phase==='between'?`Впереди — мир ${room.engine!.level+2}`:'Выберите свою стихию';el('online-start').textContent=room.phase==='failed'?'Повторить уровень':room.phase==='between'?'Следующий уровень':'Начать игру';
  const host=room.host===session.id;
  const currentDiff: DifficultyKey=(room.difficulty as DifficultyKey)||'medium';
  const signature=room.code+room.phase+room.host+currentDiff+room.members.map(m=>`${m.id}:${m.hero}:${m.ready}:${m.connected}`).join('|');
  if(signature!==previousSignature){
   previousSignature=signature;
   if(qrCode!==room.code){qrCode=room.code;void QRCode.toCanvas(el<HTMLCanvasElement>('room-qr'),`${location.origin}/?room=${room.code}`,{width:144,margin:1}).catch(()=>{el('online-error').textContent='QR недоступен. Пригласите друзей по коду комнаты.';});}
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
     const available = unlocked ? CHARACTERS : CHARACTERS.slice(0, 4);
     el('online-hero-picker').innerHTML=available.map((hero,i)=>`<button type="button" class="online-hero-card ${room!.members[me].hero===i?'is-selected':''}" data-online-hero="${i}" aria-pressed="${room!.members[me].hero===i}" aria-label="Выбрать: ${hero.name}, ${hero.element}" style="--hero-color:${hero.color}"><span class="hero-card-element" aria-hidden="true">${hero.symbol}</span>${portraitMarkup(hero)}<strong>${hero.name}</strong><span class="hero-card-element-name">${hero.element}</span><span class="hero-card-pet">${petMarkup(hero)}<small>${hero.petName}</small></span><span class="hero-card-choice">${room!.members[me].hero===i?'✓ Ваш герой':'Выбрать'}</span></button>`).join('');
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
    el('online-clock').innerHTML=`<span class="lane-location">${world.name}</span><span class="lane-timer">${String(Math.floor(remSec/60)).padStart(2,'0')}:${String(remSec%60).padStart(2,'0')}</span>`;
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
      :'Равновесие пяти миров восстановлено! Поздравляем всех героев!';
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
    submitBtn.textContent='Записать в рейтинг';

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
          },
          api
        );
        if(res.offline){
          status.textContent='✓ Сохранено на устройстве! Будет отправлено при появлении интернета.';
        }else{
          status.textContent='✓ Результат записан в рейтинг!';
        }
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
 function draw(now:number){
  requestAnimationFrame(draw);
  if(el('online').hidden||room?.phase!=='playing'||!room.engine)return;
  const engine=room.engine,cfg=DIFFICULTIES[room.difficulty||'medium'];
  const level=engine.world,speed=WORLDS[level].speed*cfg.speedMultiplier;
  const extrapolation=Math.min((now-lastReceived)/1000,.06),time=engine.tick*.02+extrapolation;
  const ownIndex=room.members.findIndex(m=>m.id===session?.id);
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
      const lift=-(o.obstacle==='overhead'?32:o.obstacle==='none'?170:112);
      at(x,lift,()=>{if(level>=3){const image=loadImage(`/assets/bonuses/world-${level}.png`);if(image.complete&&image.naturalWidth)c.drawImage(image,-18,-36,36,36);}else{c.font='28px sans-serif';c.fillText(WORLDS[level].bonus,-14,0);}});
      if(level===0&&o.obstacle==='none')drawCue(x,'⇈',-198);
    }else if(o.kind==='enemy'){
      at(x,0,()=>{const image=loadImage(`/assets/enemies/${ENEMIES[level][o.variant%2].key}.png`);const progress=o.defeatedAt?Math.min(1,(engine.tick*20-o.defeatedAt)/400):0;c.rotate(-Math.PI/2*progress);c.globalAlpha=1-progress;if(image.complete&&image.naturalWidth)c.drawImage(image,Math.floor(engine.tick/8)%4*192,0,192,192,-44,-88,88,88);});
    }else if(o.obstacle==='overhead'){
      at(x,0,()=>{const image=loadImage(`/assets/obstacles/overhead/level-${level}-variant-${o.variant%4}.png`);if(image.complete&&image.naturalWidth){c.drawImage(image,-100,-155,200,160);if(level>=3)drawArch(c,0,0,level);}else drawArch(c,0,0,level);});
      if(level===0)drawCue(x,'↓',-160);
    }else{
      at(x,0,()=>{const image=loadImage(level>=3?`/assets/obstacles/world-${level}-${o.variant%3}.png`:`/assets/obstacles/${['rock','stakes','log'][o.variant]}.png`);if(image.complete&&image.naturalWidth)c.drawImage(image,-42,-77,84,84);});
      if(level===0)drawCue(x,'↑',-90);
    }
   }
   const hero=CHARACTERS[p.hero];
   for(const shot of engine.projectiles??[])if(shot.player===i)at(shot.x+700*extrapolation,-30,()=>drawSpell(c,0,0,hero.key,now/200));
   if(i===ownIndex){
     const left=Math.max(0,(p.readyAt??0)-engine.tick*20);
     for(const id of ['online-cast','online-cast-mirror']){const button=el<HTMLButtonElement>(id);button.disabled=left>0;button.setAttribute('aria-label',SPELLS[hero.key].name);button.querySelector('small')!.textContent=left>0?(left/1000).toFixed(1)+' с':'Готово';button.style.setProperty('--charge',`${(1-left/2000)*100}%`);}
     el('online-duck').classList.toggle('is-held',p.duck);
   }
   const atlas=hero.clean?'atlas-elemental':'atlas';
   let frameName=`run-${String(Math.floor(now/(85/cfg.speedMultiplier))%hero.run).padStart(2,'0')}`;
   if(p.y<0){const flipCount=(hero.key==='kai'||hero.key==='leya')?6:4;frameName=(p.jumps||0)>=2?`flip-${String(Math.floor(now/80)%flipCount).padStart(2,'0')}`:p.velocity< -150?'jump-00':p.velocity<150?'jump-01':'jump-02';}
   else if(p.duck)frameName=`duck-${String(hero.duck-1).padStart(2,'0')}`;
   const frame=atlases.get(hero.key)?.[frameName]?.frame,image=loadImage(`/assets/characters/${hero.key}/${atlas}.png`);
   at(160,Math.min(0,p.y+p.velocity*extrapolation+950*extrapolation*extrapolation),()=>{
     if(p.lives===0){c.globalAlpha=.68;c.filter='drop-shadow(0 0 8px #00ffff) hue-rotate(155deg)';}
     const size=256*hero.scale;if(frame&&image.complete&&image.naturalWidth)c.drawImage(image,frame.x,frame.y,frame.w,frame.h,-size/2,-size*240/256,size,size);
   });
   const pet=loadImage(`/assets/pets/${hero.petRest}.png`);at(56,0,()=>{if(pet.complete&&pet.naturalWidth)c.drawImage(pet,-42,-73,83,83);});
  }
 }
 requestAnimationFrame(draw);
 el('create-room').onclick=()=>void enter('rooms');el('join-room').onsubmit=e=>{e.preventDefault();void enter(`rooms/${el<HTMLInputElement>('room-code').value}/join`)};
 el('online-difficulty-picker').onclick=e=>{const card=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-online-diff]');if(card&&!card.disabled&&card.dataset.onlineDiff)lobbyAction('difficulty',{difficulty:card.dataset.onlineDiff},next=>next.difficulty===card.dataset.onlineDiff);};
 el('online-hero-picker').onclick=e=>{const card=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-online-hero]');if(card&&!card.disabled)lobbyAction('hero',{hero:Number(card.dataset.onlineHero)},next=>next.members.find(member=>member.id===session?.id)?.hero===Number(card.dataset.onlineHero))};
 el('online-ready').onclick=()=>lobbyAction('ready',{},next=>next.members.find(member=>member.id===session?.id)?.ready===true);el('online-start').onclick=()=>{const phase=room?.phase;lobbyAction('start',{},next=>next.phase!==phase)};el('online-back').onclick=()=>{disconnect();show('home')};el('copy-invite').onclick=()=>{if(room)void navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`).then(()=>{el('connection-status').textContent='Приглашение скопировано'}).catch(()=>{el('online-error').textContent=`${location.origin}/?room=${room!.code}`})};
 const held=new Set<string>();const release=(source:string)=>{held.delete(source);if(!held.size)transmit('duck',{pressed:false})};
 for(const id of ['online-cast','online-cast-mirror'])el(id).onpointerdown=e=>{e.preventDefault();transmit('cast')};
 el('online-jump').onpointerdown=e=>{e.preventDefault();transmit('jump')};const duck=el('online-duck');duck.onpointerdown=e=>{e.preventDefault();duck.setPointerCapture(e.pointerId);held.add(`p${e.pointerId}`);transmit('duck',{pressed:true})};for(const type of ['pointerup','pointercancel','lostpointercapture'])duck.addEventListener(type,e=>release(`p${(e as PointerEvent).pointerId}`));
 window.addEventListener('keydown',e=>{if(el('online').hidden||room?.phase!=='playing')return;if(['KeyW','ArrowUp','KeyS','ArrowDown','KeyD','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(['KeyD','ArrowRight'].includes(e.code))transmit('cast');if(['KeyW','ArrowUp'].includes(e.code))transmit('jump');if(['KeyS','ArrowDown'].includes(e.code)){held.add(e.code);transmit('duck',{pressed:true})}});window.addEventListener('keyup',e=>{if(['KeyS','ArrowDown'].includes(e.code))release(e.code)});window.addEventListener('blur',()=>{held.clear();clearControls()});document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();clearControls()}});
 let currentRankingDiff: DifficultyKey = 'medium';
 let rankingLoading = false;
 async function ranking(diff: DifficultyKey = currentRankingDiff){
  if(rankingLoading)return;
  rankingLoading = true;
  const tabs = document.querySelectorAll<HTMLButtonElement>('.ranking-tab');
  const reload = el<HTMLButtonElement>('ranking-reload');
  tabs.forEach(tab => { tab.disabled = true; });
  reload.disabled = true;
  el('ranking-list').setAttribute('aria-busy', 'true');
  currentRankingDiff = diff;
  void syncPendingRankings(api);
  document.querySelectorAll<HTMLElement>('.ranking-tab').forEach(tab => {
   const isSel = tab.dataset.diff === diff;
   tab.classList.toggle('is-active', isSel);
   tab.setAttribute('aria-selected', String(isSel));
  });
  const status=el('ranking-status'),list=el('ranking-list'),weekEl=el('ranking-week');
  status.textContent='Связываемся с книгой рекордов…';status.className='ranking-status is-loading';
  list.replaceChildren();
  weekEl.textContent='';
  const cfg = DIFFICULTIES[diff] ?? DIFFICULTIES.medium;
  try{
   const data=await api<{week:string;difficulty:string;entries:{name:string;score:number}[]}>(`ranking?difficulty=${diff}`);
   weekEl.textContent=`Турнирная неделя с ${data.week} · Топ 20 игроков сложности «${cfg.name}» (${cfg.levelSeconds} сек) · обновление в понедельник в 00:00 МСК`;
   if(!data.entries||!data.entries.length){
    status.className='ranking-status';
    status.innerHTML=`<div class="ranking-empty"><span class="empty-rune" aria-hidden="true">${cfg.icon}</span><strong>Свиток рекордов сложности «${cfg.name}» пока пуст!</strong><p>Турнир этой недели только начался. Пройдите все миры и станьте первыми чемпионами недели на сложности «${cfg.name}»!</p></div>`;
    return;
   }
   status.textContent='';status.className='ranking-status';
   data.entries.slice(0,TOP_RANKING_LIMIT).forEach((row,i)=>{
    const li=document.createElement('li'),rank=i+1;
    li.className=`ranking-row ${rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'rank-other'}`;
    const badge=document.createElement('span');badge.className='rank-badge';
    badge.textContent=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':String(rank);
    const name=document.createElement('span');name.className='rank-name';name.textContent=row.name;
    const score=document.createElement('strong');score.className='rank-score';
    score.innerHTML=`${row.score} <small>очков</small>`;
    li.append(badge,name,score);list.append(li);
   });
  }catch{
   try{
    const localList = getLocalRecords(diff);
    if(localList.length){
     weekEl.textContent=`Рекорды на этом устройстве (офлайн) · Топ 20 игроков сложности «${cfg.name}» (${cfg.levelSeconds} сек)`;
     status.textContent='';status.className='ranking-status';
     localList.forEach((row,i)=>{
      const li=document.createElement('li'),rank=i+1;
      li.className=`ranking-row ${rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'rank-other'}`;
      const badge=document.createElement('span');badge.className='rank-badge';
      badge.textContent=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':String(rank);
      const name=document.createElement('span');name.className='rank-name';name.textContent=row.name;
      const score=document.createElement('strong');score.className='rank-score';
      score.innerHTML=`${row.score} <small>очков</small>`;
      li.append(badge,name,score);list.append(li);
     });
     return;
    }
   }catch{}
   status.className='ranking-status is-error';
   status.innerHTML='<div class="ranking-error"><span aria-hidden="true">📡</span><p>Нет связи с сервером рейтинга. Проверьте интернет и нажмите «Обновить».</p></div>';
  }finally{
   rankingLoading = false;
   tabs.forEach(tab => { tab.disabled = false; });
   reload.disabled = false;
   list.setAttribute('aria-busy', 'false');
  }
 }
 window.addEventListener('online',()=>void syncPendingRankings(api));
 void syncPendingRankings(api);
 el('ranking-reload').onclick=()=>void ranking(currentRankingDiff);
 document.querySelectorAll<HTMLElement>('.ranking-tab').forEach(tab=>{
  tab.onclick=()=>{
   const diff = (tab.dataset.diff as DifficultyKey) || 'medium';
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
