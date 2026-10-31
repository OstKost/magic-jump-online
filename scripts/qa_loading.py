"""Loading UI smoke checks with controlled HTTP and WebSocket responses. Requires Chrome."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 for name,w,h in [('desktop',1440,1000),('phone',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h})
  page.add_init_script('''
  window.commands=[];
  window.testRoom={code:'1234',id:'room',host:'me',phase:'lobby',difficulty:'medium',members:[{id:'me',hero:0,ready:false,connected:true},{id:'friend',hero:1,ready:true,connected:true}]};
  const NativeSocket=window.WebSocket;
  class Socket {static OPEN=1;readyState=1;constructor(url,...protocols){if(!String(url).includes('/api/rooms/'))return new NativeSocket(url,...protocols);window.socket=this;setTimeout(()=>this.onopen?.(),30)}send(raw){window.commands.push(JSON.parse(raw))}close(){this.readyState=3} }
  window.WebSocket=Socket;
  window.deliver=()=>window.socket.onmessage({data:JSON.stringify(window.testRoom)});
  ''')
  page.route('**/api/attempts',lambda r:r.fulfill(status=503,body='offline'))
  page.route('**/api/rooms',lambda r:r.fulfill(json={'code':'1234','id':'me','token':'secret'}))
  page.goto('http://localhost:5173')
  page.locator('#splash').click()
  page.locator('#solo-menu').click()
  # Hold the request to inspect the waiting state.
  page.unroute('**/api/attempts')
  pending=[]
  page.route('**/api/attempts',lambda r:pending.append(r))
  page.locator('[data-difficulty="easy"]').click()
  assert page.locator('#difficulty-select button:disabled').count()==4
  assert page.locator('.request-loading').count()>0
  page.screenshot(path=str(OUT/f'local-loading-{name}.png'))
  pending[0].fulfill(status=503,body='offline')
  page.locator('#character-select').wait_for(state='visible')
  page.locator('#selection-back').click()
  page.locator('#difficulty-back').click()
  page.locator('#online-menu').click()
  page.locator('#create-room').click()
  page.wait_for_function('typeof window.socket?.onmessage==="function"')
  assert page.locator('#create-room').is_disabled()
  page.screenshot(path=str(OUT/f'room-loading-{name}.png'))
  page.evaluate('deliver()')
  page.locator('#lobby').wait_for(state='visible')
  for selector,mutation in [('[data-online-diff="hard"]',"testRoom.difficulty='hard'"),('[data-online-hero="2"]','testRoom.members[0].hero=2'),('#online-ready','testRoom.members[0].ready=true'),('#online-start',"testRoom.phase='between';testRoom.engine={level:0,players:[]}")]:
   page.locator(selector).click()
   assert page.locator('#online-ready').is_disabled()
   assert page.locator('#online-start').is_disabled()
   assert 'Ждём подтверждения' in page.locator('#lobby-guidance').inner_text()
   page.screenshot(path=str(OUT/f'lobby-loading-{name}.png'))
   page.evaluate(mutation+';deliver()')
  assert page.locator('#online-start').is_enabled()
  if name == 'desktop':
   page.locator('#online-start').click()
   page.wait_for_function("document.querySelector('#online-error').textContent.includes('Нет подтверждения')",timeout=15000)
   assert page.locator('#online-start').is_enabled()
   page.evaluate('socket.onclose({code:1006})')
   assert page.locator('#online-start').is_disabled()
   page.wait_for_timeout(1400)
   page.evaluate('deliver()')
   assert page.locator('#online-start').is_enabled()
  page.close()
 browser.close()
print('Desktop and phone: local start, room handshake, difficulty, hero, ready and start passed')
