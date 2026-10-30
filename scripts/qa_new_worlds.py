"""Visual smoke checks for seeded five-world journeys (running Vite server)."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('artifacts/qa');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':1280,'height':720})
 errors=[];missing=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.on('response',lambda response:missing.append(response.url) if response.status==404 and '/assets/' in response.url else None)
 page.goto(os.environ.get('JOURNEY_QA_URL','http://localhost:5174'))
 page.wait_for_timeout(1500);page.keyboard.press('Space');page.wait_for_timeout(700)
 page.locator('#solo-menu').click();page.locator('[data-difficulty="easy"]').click();page.locator('#confirm-character').click()
 page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.qaGame=game;}''')
 page.wait_for_function('qaGame.scene.scenes.length>0 && qaGame.scene.scenes[0].runners.length>0')
 page.evaluate('window.scene=qaGame.scene.scenes[0];scene.seed=42')
 seen=[]
 for stage in range(5):
  page.evaluate('(stage)=>{scene.level=stage;scene.prepareLevel();}',stage)
  seen.append(page.evaluate('scene.world'))
  if page.evaluate('scene.world')>=3:
   page.locator('[data-ready="0"]').click();page.wait_for_function('scene.playing')
   page.evaluate('''()=>{scene.plan=[];for(let v=0;v<3;v++)scene.spawn({row:0,at:v*2000,kind:'obstacle',variant:v,obstacle:'ground'});scene.items.forEach((item,i)=>{item.x=400+i*220;item.icon.x=item.x});scene.spawn({row:0,at:0,kind:'enemy',variant:0});scene.items.at(-1).x=1000;scene.items.at(-1).icon.x=1000;scene.togglePause();}''')
   # Pause overlay hides scenery; hide it only for the screenshot.
   page.locator('#overlay').evaluate('(el)=>el.hidden=true')
   world=page.evaluate('scene.world')
   page.screenshot(path=str(out/f'world-{world}-desktop.png'))
   page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(200)
   page.screenshot(path=str(out/f'world-{world}-phone.png'))
   page.set_viewport_size({'width':1280,'height':720});page.wait_for_timeout(250)
   page.evaluate("""()=>{scene.items.forEach(i=>i.icon.destroy());scene.items=[];scene.spawn({row:0,at:0,kind:'obstacle',variant:0,obstacle:'overhead'});scene.spawn({row:0,at:0,kind:'bonus',variant:0,obstacle:'ground'});scene.spawn({row:0,at:0,kind:'enemy',variant:1,obstacle:'ground'});scene.items.forEach((item,i)=>{item.x=450+i*250;item.icon.x=item.x});}""")
   page.screenshot(path=str(out/f'world-{world}-hazards.png'))
 page.evaluate('scene.finish()')
 assert 'пять миров' in page.locator('#result-description').inner_text()
 assert seen==[0,3,4,1,2],seen
 assert not errors,errors
 assert not missing,missing
 print('Five worlds and seeded order verified; screenshots saved.',flush=True)
 browser.close()
