"""Local tutorial cues: six elements, two lanes, pause, fade and retry."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 for label,size in [('desktop',{'width':1440,'height':1000}),('phone',{'width':844,'height':390})]:
  page=browser.new_page(viewport=size)
  page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
  page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('JOURNEY_QA_URL','http://localhost:5173'),wait_until='domcontentloaded')
  page.evaluate("async()=>{const {game}=await import(document.querySelector('script[src*=\\"/src/main.ts\\"]').src);window.qaGame=game}")
  page.wait_for_function('window.qaGame?.scene.scenes[0]?.textures?.exists("sofia")')
  page.evaluate("window.scene=qaGame.scene.scenes[0]")
  page.wait_for_timeout(2000)
  page.locator('#splash').dispatch_event('pointerdown');page.wait_for_timeout(800)
  page.locator('#play-menu').dispatch_event('click');page.locator('[data-difficulty="medium"]').dispatch_event('click')
  page.wait_for_function('!document.querySelector("#character-select").hidden && !document.querySelector("#confirm-character").disabled')
  page.locator('#confirm-character').dispatch_event('click');page.locator('#confirm-character').dispatch_event('click')
  page.wait_for_function('scene.awaitingReady')
  page.evaluate('scene.markReady(0);scene.markReady(1);scene.begin()')
  page.wait_for_function('scene.playing')
  for pair in range(3):
   page.evaluate('''pair=>{scene.paused=true;scene.items.forEach(i=>{i.icon.destroy();i.cueView?.destroy()});scene.items=[];for(let row=0;row<2;row++){scene.spawn({row,at:0,kind:'obstacle',obstacle:'ground',variant:0});scene.spawn({row,at:0,kind:'obstacle',obstacle:'overhead',variant:0});scene.spawn({row,at:0,kind:'bonus',obstacle:'none',variant:0});}scene.items.forEach((i,n)=>{i.x=450+(n%3)*250;i.icon.x=i.x;scene.updateCue(i);let color=['#71cce8','#efaa76','#a2e0da','#a9c78c','#a855f7','#22c55e'][pair*2+i.row];i.cueView.list.forEach(t=>t.setColor(color));i.cueView.list[1].setText(["≈","♨","彡","◇","ϟ","❧"][pair*2+i.row]);});}''',pair)
   page.wait_for_timeout(100);page.screenshot(path=str(OUT/f'cues-{label}-{pair}.png'))
  page.evaluate('''()=>{const i=scene.items[0];i.x=160+i.cue.offset;scene.paused=false;scene.jump(0);if(i.cue.fadingAt===undefined)throw Error('jump did not consume');scene.paused=true;window.alpha=i.cueView.alpha;}''')
  page.wait_for_timeout(200);assert page.evaluate('scene.items[0].cueView.alpha===window.alpha')
  page.evaluate('scene.paused=false');page.wait_for_timeout(200);assert page.evaluate('scene.items[0].cueView.alpha===0')
  page.evaluate('scene.players.forEach(p=>p.lives=0)');page.locator('#result').wait_for();page.locator('#result-next').dispatch_event('click')
  assert page.evaluate('scene.items.length===0')
  assert not errors,errors
  page.close()
 browser.close()
 print('Tutorial cues desktop/phone, six colors, pause, fade and retry passed')
