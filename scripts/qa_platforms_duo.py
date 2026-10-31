"""Local two-player terrain smoke check."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    for width,height in [(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
        page.goto('http://localhost:5173');page.locator('#splash').click();page.locator('#play-menu').click();page.locator('[data-difficulty="medium"]').click();page.locator('#confirm-character').click();page.locator('#confirm-character').click()
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.game=game;}''')
        page.wait_for_function('(window.scene=game.scene.scenes[0])&&scene.awaitingReady');page.keyboard.press('w');page.keyboard.press('ArrowUp');page.wait_for_function('scene.playing')
        page.evaluate('''()=>{scene.plan=[];for(const item of scene.items){item.icon.destroy();item.cueView?.destroy()}scene.items=[];for(let row=0;row<2;row++){scene.spawn({at:0,kind:'platform',variant:0,width:480,height:90,offset:-90,row});scene.spawn({at:0,kind:row?'fire':'puddle',variant:0,width:260,row});for(const item of scene.items.filter(o=>o.row===row)){item.x-=560;item.icon.x=item.x}scene.jump(row);}}''')
        page.wait_for_function('scene.runners.every(r=>r.grounded&&r.y===-90)')
        page.evaluate('''()=>{for(let row=0;row<2;row++)for(let n=0;n<6;n++){scene.spawn({at:0,kind:'bonus',variant:0,height:125,row});const coin=scene.items.at(-1);coin.x=250+n*50;coin.icon.x=coin.x}scene.togglePause();document.querySelector('#overlay').hidden=true;}''')
        page.screenshot(path=str(OUT/f'platforms-duo-{width}.png'))
        assert not errors,errors
        page.close()
    browser.close()
print('Local two-player desktop and phone platform checks passed')
