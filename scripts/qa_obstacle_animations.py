"""Exercise packed animations in the actual Phaser scene on desktop and phone.

Requires a running Vite server and Playwright with Chrome installed.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173')
OUT = Path('artifacts/qa/obstacle-animations')
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, channel=os.environ.get('JOURNEY_QA_BROWSER_CHANNEL'))
    for width, height in [(1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        page.route('https://fonts.gstatic.com/**', lambda route: route.abort())
        page.goto(BASE, wait_until='domcontentloaded')
        page.wait_for_timeout(1500)
        page.keyboard.press('Space')
        page.locator('#solo-menu').click()
        page.locator('[data-difficulty="easy"]').click()
        page.locator('#confirm-character').click()
        page.locator('[data-ready="0"]').click()
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.gameForQa=game;window.scene=game.scene.scenes[0];}''')
        page.wait_for_function('()=>{window.scene=window.gameForQa.scene.scenes[0];return !!scene?.playing&&scene.runners.length===1;}')
        page.evaluate('''()=>{scene.paused=true;scene.plan=[];scene.players[0].invulnerable=1e9;}''')
        for world in range(5):
            for kind in ['ground', 'overhead', 'enemy']:
                page.evaluate('''({world,kind})=>{
                    for(const item of scene.items){item.icon.destroy();item.cueView?.destroy();}scene.items=[];
                    Object.defineProperty(scene,'world',{value:world,configurable:true});
                    const count=kind==='ground'?3:kind==='enemy'?2:world>=3?2:4;
                    for(let v=0;v<count;v++){
                        scene.spawn({at:kind==='overhead'?v*1900:2200,kind:kind==='enemy'?'enemy':'obstacle',obstacle:kind==='overhead'?'overhead':'ground',variant:v,row:0});
                        const item=scene.items.at(-1);item.x=300+v*220;item.icon.x=item.x;item.cueView?.setVisible(false);
                    }
                    scene.step();
                }''', {'world': world, 'kind': kind})
                first = page.evaluate('scene.items.map(item=>item.icon.first.frame.name)')
                for _ in range(9):
                    page.evaluate('scene.step()')
                second = page.evaluate('scene.items.map(item=>item.icon.first.frame.name)')
                assert first != second, (world, kind, first, second)
                paused_time = page.evaluate('scene.elapsed')
                page.wait_for_timeout(180)
                assert page.evaluate('scene.elapsed') == paused_time
                page.screenshot(path=str(OUT / f'{width}-world-{world}-{kind}.png'))
                if kind == 'enemy':
                    page.evaluate('''()=>{scene.items[0].defeatedAt=scene.elapsed;scene.items[0].passed=true;scene.step();}''')
                    assert page.evaluate('Number(scene.items[0].icon.first.frame.name)') == 8
                    for _ in range(16):
                        page.evaluate('scene.step()')
                    assert page.evaluate('Number(scene.items[0].icon.first.frame.name)') == 10
        assert not errors, errors
        page.close()
    browser.close()
print('Five worlds, desktop and phone: live frames, pause and enemy defeat passed')
