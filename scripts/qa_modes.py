"""Smoke checks for local modes and four independent online browsers."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('JOURNEY_QA_URL','http://localhost:5173')
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 errors=[]
 def page():
  ctx=browser.new_context(viewport={'width':844,'height':390});ctx.route('https://fonts.googleapis.com/**',lambda route:route.abort());ctx.route('https://fonts.gstatic.com/**',lambda route:route.abort())
  print('new browser',flush=True);tab=ctx.new_page();tab.set_default_timeout(15000);tab.on('pageerror',lambda e:errors.append(str(e)));tab.goto(BASE,wait_until='domcontentloaded');tab.wait_for_timeout(1200);tab.keyboard.press('Space');tab.wait_for_timeout(800);print('browser ready',flush=True);return tab
 print('local modes',flush=True)
 local=page();local.locator('#solo-menu').click();local.locator('#confirm-character').click();local.locator('[data-ready="0"]').click();local.wait_for_timeout(200)
 local.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.scene=game.scene.scenes[0]}''')
 local.wait_for_function('scene.runners.length===1&&scene.playing',timeout=15000)
 local.keyboard.press('ArrowUp');local.wait_for_function('scene.runners[0].y<0')
 local.screenshot(path=str(OUT/'solo.png'))
 local.evaluate('scene.players[0].lives=0');local.locator('#result').wait_for();assert local.locator('#result').evaluate('(el)=>el.classList.contains("is-defeat")')
 local.locator('#result-menu').click();local.locator('#play-menu').click();local.locator('#confirm-character').click();local.locator('#confirm-character').click();assert local.locator('[data-ready]').count()==2
 local.locator('[data-ready="0"]').click();local.wait_for_timeout(100);assert local.evaluate('!scene.playing');local.locator('[data-ready="1"]').click();local.wait_for_function('scene.runners.length===2&&scene.playing',timeout=15000);local.screenshot(path=str(OUT/'local-two.png'))
 local.evaluate('scene.players[0].lives=0');local.wait_for_function('scene.runners[0].y===0');local.keyboard.press('w');local.wait_for_function('scene.runners[0].y<0&&scene.playing');local.screenshot(path=str(OUT/'ghost.png'))
 local.evaluate('scene.players[1].lives=0');local.locator('#result').wait_for();assert local.locator('#result').evaluate('(el)=>el.classList.contains("is-defeat")')
 local.locator('#result-next').click();assert local.evaluate('scene.level===0&&scene.players.every(p=>p.lives===3)&&scene.players.every(p=>p.score===0)')
 local.context.close()
 print('online modes',flush=True)
 tabs=[page() for _ in range(4)]
 print('creating room',flush=True);tabs[0].locator('#online-menu').click();tabs[0].locator('#create-room').click();tabs[0].locator('#invite-code').wait_for();code=tabs[0].locator('#invite-code').inner_text().split()[-1]
 print('joining friends',flush=True)
 for tab in tabs[1:]:
  tab.locator('#online-menu').click();tab.locator('#room-code').fill(code);tab.locator('#join-room button').click();tab.locator('#online-ready').wait_for()
 print('choosing matching heroes',flush=True)
 for tab in tabs:
  assert tab.locator('[data-online-hero]').count()==4
  tab.locator('[data-online-hero="0"]').click()
  expect(tab.locator('[data-online-hero="0"]')).to_have_attribute('aria-pressed','true')
 tabs[0].screenshot(path=str(OUT/'online-lobby.png'))
 print('readying all four',flush=True)
 for tab in tabs:tab.locator('#online-ready').click()
 tabs[0].locator('#online-start').click();tabs[0].locator('#online-match').wait_for();tabs[0].wait_for_timeout(1000)
 for i,tab in enumerate(tabs):
  assert tab.locator('#opponent-lanes canvas').count()==3
  assert tab.locator('#own-lane canvas').count()==1
  tab.screenshot(path=str(OUT/f'online-{i+1}.png'))
 tabs[0].locator('#online-jump').dispatch_event('pointerdown')
 print('reconnect',flush=True)
 tabs[1].reload(wait_until='domcontentloaded');tabs[1].locator('#online-match').wait_for(timeout=10000)
 tabs[0].locator('#online-back').click();tabs[0].locator('#ranking-menu').click();tabs[0].locator('#ranking-week').wait_for();tabs[0].screenshot(path=str(OUT/'ranking.png'))
 assert not errors,errors
 browser.close()
 print('Solo, ghosts, local two-player, four-player room, reconnect and ranking passed')
