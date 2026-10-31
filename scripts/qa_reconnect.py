"""Real local room: authenticated deadlines, 5s return, >30s expiry and released duck."""
import os,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('JOURNEY_QA_URL','http://localhost:5176')
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 tabs=[]
 for _ in range(2):
  c=b.new_context(viewport={'width':844,'height':390})
  c.route('https://fonts.googleapis.com/**',lambda r:r.abort());c.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  c.add_init_script('''const Native=WebSocket;window.blockSockets=false;window.sockets=[];window.WebSocket=class extends Native {constructor(...args){super(...args);window.sockets.push(this);if(window.blockSockets)this.addEventListener('open',()=>this.close())}send(raw){if(!window.blockSockets)super.send(raw)}}''')
  page=c.new_page();page.goto(BASE,wait_until='domcontentloaded');page.locator('#splash').click();page.locator('#online-menu').click();tabs.append(page)
 host,guest=tabs
 host.locator('#create-room').click();host.locator('#online-ready').wait_for();code=host.locator('#invite-code').inner_text().split()[-1]
 guest.locator('#room-code').fill(code);guest.locator('#join-room button').click();guest.locator('#online-ready').wait_for()
 host.locator('[data-online-diff="hard"]').click();expect(guest.locator('[data-online-diff="hard"]')).to_have_attribute('aria-pressed','true')
 for page in tabs:page.locator('#online-ready').click()
 host.locator('#online-start').click();guest.locator('#online-match').wait_for()
 guest.locator('#online-duck').dispatch_event('pointerdown',{'pointerId':1})
 # Block reconnection before authentication while HTTP status remains available.
 def outage(page):
  page.evaluate('window.blockSockets=true;window.sockets.at(-1).close()')
 print('outage 5s',flush=True);outage(guest)
 expect(guest.locator('#connection-status')).to_contain_text('возврат:')
 expect(host.locator('#connection-status')).to_contain_text('нет связи')
 print('deadline confirmed',flush=True);guest.screenshot(path=str(OUT/'reconnect-deadline.png'),timeout=10000);print('captured',flush=True)
 guest.wait_for_timeout(5000)
 guest.evaluate('window.blockSockets=false')
 guest.wait_for_timeout(1500)
 expect(guest.locator('#connection-status')).to_have_text('Подключено')
 assert not guest.locator('#online-duck').evaluate('(el)=>el.classList.contains("is-held")')
 print('outage 31.5s',flush=True);outage(guest);expect(guest.locator('#connection-status')).to_contain_text('возврат:')
 guest.wait_for_timeout(31500)
 expect(guest.locator('#room-entry')).to_be_visible();expect(guest.locator('#online-error')).to_contain_text('Вы выбыли')
 guest.screenshot(path=str(OUT/'reconnect-expired.png'))
 b.close()
print('Real room reconnect: 5s return, server deadline, friend notice, controls release and >30s new-room route passed')
