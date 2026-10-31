"""Solo HUD, screen sizes, touch controls and local two-player regression."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os
out=Path('artifacts/qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True)
 page=b.new_page(viewport={'width':844,'height':390},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('JOURNEY_QA_URL','http://localhost:5173'));page.wait_for_timeout(1300);page.keyboard.press('Space');page.wait_for_timeout(800)
 page.locator('#solo-menu').click();page.locator('[data-difficulty="easy"]').click();page.locator('#confirm-character').click();page.locator('[data-ready="0"]').click()
 page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.scene=game.scene.scenes[0]}''')
 page.wait_for_function('scene.playing');page.evaluate('setInterval(()=>scene.players.forEach(p=>p.lives=3),100)')
 for w,h in [(667,375),(844,390),(932,430),(1440,900)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(250)
  assert page.evaluate('Math.abs(scene.ground(0)-scene.scale.height*.92)<1')
  for sel in ['[data-jump="0"]','[data-duck="0"]','[data-cast="0"]','[data-dash="0"]','#pause']:
   r=page.locator(sel).first.bounding_box();assert r and r['x']>=0 and r['y']>=0 and r['x']+r['width']<=w and r['y']+r['height']<=h,(sel,r)
  page.screenshot(path=str(out/f'solo-ux-{w}.png'))
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(200)
 client=page.context.new_cdp_session(page)
 def point(sel,ident):
  r=page.locator(sel).first.bounding_box();return {'x':r['x']+r['width']/2,'y':r['y']+r['height']/2,'id':ident}
 duck=point('[data-duck="0"]',7);cast=point('[data-cast="0"]',8)
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[duck]})
 page.wait_for_function('scene.runners[0].duckInputs.size>0')
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[duck,cast]})
 assert page.evaluate('scene.readyAt[0]>scene.elapsed')
 client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
 page.wait_for_function('scene.runners[0].duckInputs.size===0')
 page.keyboard.press('ArrowUp');page.wait_for_function('scene.runners[0].y<0')
 page.locator('#pause').click();assert page.evaluate('scene.paused');assert page.locator('#pause-location').inner_text()
 page.screenshot(path=str(out/'solo-ux-pause.png'));page.locator('#resume').click();assert page.evaluate('!scene.paused')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250);assert page.evaluate('scene.paused')
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(250);assert page.evaluate('!scene.paused')
 page.locator('#pause').click();page.locator('#pause-home').click();page.locator('#play-menu').click();page.locator('[data-difficulty="easy"]').click();page.locator('#confirm-character').click();page.locator('#confirm-character').click()
 page.locator('[data-ready="0"]').click();page.locator('[data-ready="1"]').click();page.wait_for_function('scene.playing');assert page.evaluate('scene.runners.length===2');page.screenshot(path=str(out/'solo-ux-two-regression.png'))
 assert not errors,errors
 b.close();print('Solo layouts, actions, pause, rotation and two-player regression passed')
