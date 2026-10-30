"""Combat integration checks against Vite and the Go server."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173')
OUT = Path('artifacts/qa'); OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    def open_game(width, height, mobile=False):
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=mobile, has_touch=mobile)
        context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        context.route('https://fonts.gstatic.com/**', lambda route: route.abort())
        page = context.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE); page.wait_for_timeout(1000); page.locator('#splash').click(); page.wait_for_timeout(500)
        return page
    for width, height, mobile in [(1440, 900, False), (844, 390, True)]:
        page = open_game(width, height, mobile)
        page.locator('#solo-menu').click(); page.locator('[data-difficulty="easy"]').click()
        page.locator('#confirm-character').click(); page.locator('[data-ready="0"]').click()
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.game=game}''')
        page.wait_for_function('(window.scene=game.scene.scenes[0])&&scene.playing')
        page.evaluate('''()=>{for(const i of scene.items){i.icon.destroy();i.cueView?.destroy()}scene.items=[];scene.plan=[];scene.spawn({at:0,kind:'enemy',variant:0,obstacle:'ground',row:0});scene.items[0].x=430;scene.items[0].icon.x=430;}''')
        before = page.evaluate('scene.players[0].score')
        if mobile: page.locator('[data-cast="0"]').tap()
        else: page.keyboard.press('d')
        page.wait_for_function(f'scene.players[0].score==={before+25}')
        assert page.evaluate('scene.items[0].defeatedAt!==undefined')
        page.keyboard.press('ArrowRight')
        assert page.evaluate('scene.shots.length===0')
        page.wait_for_timeout(450)
        page.evaluate('''()=>{scene.spawn({at:0,kind:'enemy',variant:1,obstacle:'ground',row:0});const enemy=scene.items.at(-1);enemy.x=950;enemy.icon.x=950;scene.togglePause()}''')
        elapsed = page.evaluate('scene.elapsed'); page.wait_for_timeout(200)
        assert page.evaluate('scene.elapsed') == elapsed
        page.evaluate("document.querySelector('#overlay').hidden=true")
        page.screenshot(path=str(OUT / ('combat-phone.png' if mobile else 'combat-desktop.png')))
        page.evaluate('scene.togglePause()')
        page.wait_for_timeout(1800)
        page.evaluate('''()=>{scene.items.at(-1).x=400;scene.items.at(-1).icon.x=400;}''')
        page.keyboard.press('ArrowRight')
        page.wait_for_function(f'scene.players[0].score==={before+50}')
        # Render both enemy variants across the current five-world journey.
        page.evaluate('''()=>{for(const item of scene.items){item.icon.destroy();item.cueView?.destroy()}scene.items=[];for(let level=0;level<5;level++){scene.level=level;for(let variant=0;variant<2;variant++){scene.spawn({at:0,kind:'enemy',variant,obstacle:'ground',row:0});const item=scene.items.at(-1);item.x=290+level*155+variant*70;item.icon.x=item.x;}}scene.togglePause();}''')
        page.evaluate("document.querySelector('#overlay').hidden=true")
        page.screenshot(path=str(OUT / ('combat-roster-phone.png' if mobile else 'combat-roster-desktop.png')))
        page.context.close()
    # Exercise the real server protocol and renderer in two independent sessions.
    host = open_game(1200, 800); guest = open_game(844, 390, True)
    host.locator('#online-menu').click(); host.locator('#create-room').click()
    host.locator('#invite-code').wait_for(); code = host.locator('#invite-code').inner_text().split()[-1]
    guest.locator('#online-menu').click(); guest.locator('#room-code').fill(code); guest.locator('#join-room button').click()
    for page in [host, guest]: page.locator('#online-ready').click()
    host.locator('#online-start').click(); host.locator('#online-cast').wait_for()
    host.wait_for_timeout(1000); host.keyboard.press('d'); host.wait_for_timeout(150)
    assert host.locator('#online-cast').is_disabled()
    guest.locator('#online-cast').tap(); guest.wait_for_timeout(150)
    assert guest.locator('#online-cast').is_disabled()
    host.wait_for_timeout(2100); assert host.locator('#online-cast').is_enabled()
    host.wait_for_timeout(2000); host.screenshot(path=str(OUT / 'combat-online.png'))
    assert not errors, errors
    browser.close()
print('Combat desktop, phone and online checks passed')
