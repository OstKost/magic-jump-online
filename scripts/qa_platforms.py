"""Desktop/phone smoke coverage for terrain, audio and animated combat."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('JOURNEY_QA_URL','http://localhost:5173')
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    errors=[]
    for width,height,mobile in [(1440,900,False),(844,390,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
        context.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        context.route('https://fonts.gstatic.com/**',lambda r:r.abort())
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE);page.locator('#splash').click();page.locator('#solo-menu').click();page.locator('[data-difficulty="easy"]').click();page.locator('#confirm-character').click()
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.game=game;}''')
        page.wait_for_function('(window.scene=game.scene.scenes[0])&&scene.awaitingReady');page.locator('[data-ready="0"]').click() if mobile else page.keyboard.press('w');page.wait_for_function('scene.playing')
        page.evaluate('''()=>{scene.plan=[];for(const i of scene.items){i.icon.destroy();i.cueView?.destroy()}scene.items=[];scene.spawn({at:0,kind:'platform',variant:0,offset:-90,width:480,height:90,row:0});scene.spawn({at:0,kind:'gap',variant:0,width:260,row:0});for(const item of scene.items){item.x-=560;item.icon.x=item.x}scene.jump(0);}''')
        page.wait_for_function('scene.runners[0].grounded && scene.runners[0].y===-90')
        page.evaluate('''()=>{scene.spawn({at:0,kind:'bonus',variant:0,height:125,row:0});const item=scene.items.at(-1);item.x=180;item.icon.x=180;}''')
        score=page.evaluate('scene.players[0].score');page.wait_for_function(f'scene.players[0].score>{score}')
        page.evaluate("""()=>{for(let n=0;n<6;n++){scene.spawn({at:0,kind:'bonus',variant:0,height:125,row:0});const coin=scene.items.at(-1);coin.x=240+n*55;coin.icon.x=coin.x;}scene.togglePause();document.querySelector('#overlay').hidden=true;}""")
        page.screenshot(path=str(OUT/f'platform-chain-{width}.png'))
        page.evaluate('scene.togglePause()')
        # Audio buttons are real clickable controls and preserve state.
        button=page.locator('#play-screen [data-audio-channel="music"]');before=button.get_attribute('aria-pressed');button.click();assert button.get_attribute('aria-pressed')!=before;button.click()
        page.evaluate('''()=>{scene.spawn({at:0,kind:'enemy',variant:0,obstacle:'ground',row:0});const item=scene.items.at(-1);item.x=520;item.icon.x=520;scene.runners[0].y=0;scene.runners[0].velocity=0;scene.runners[0].grounded=true;scene.readyAt[0]=0;scene.cast(0);}''')
        page.wait_for_function("scene.items.some(i=>i.kind==='enemy'&&i.defeatedAt!==undefined)")
        page.screenshot(path=str(OUT/f'platforms-{width}.png'))
        page.evaluate('''()=>{for(const i of scene.items){i.icon.destroy();i.cueView?.destroy()}scene.items=[];scene.spawn({at:0,kind:'gap',variant:0,width:1000,row:0});scene.items[0].x=160;scene.runners[0].y=0;scene.runners[0].velocity=0;scene.players[0].invulnerable=0;}''')
        lives=page.evaluate('scene.players[0].lives');page.wait_for_function(f'scene.players[0].lives==={lives-1}')
        assert page.evaluate('scene.runners[0].fallUntil>scene.elapsed')
        context.close()
    assert not errors,errors
    browser.close()
print('Desktop and phone: platform landing, bonus, audio toggles, combat and fall passed')
