"""Check the common player window, readiness centers, and thumb/rail layouts."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('artifacts/qa')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    errors = []
    for count in [1, 2]:
        page = browser.new_page(viewport={'width': 844, 'height': 390}, has_touch=True)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173'))
        page.wait_for_timeout(1400)
        page.keyboard.press('Space')
        page.wait_for_timeout(700)
        page.locator('#solo-menu' if count == 1 else '#play-menu').click()
        page.locator('[data-difficulty="easy"]').click()
        for _ in range(count):
            page.locator('#confirm-character').click()
        page.locator('[data-ready="0"]').wait_for()
        page.wait_for_timeout(500)
        page.screenshot(path=str(out / f'window-{count}-ready-phone.png'))
        for row in range(count):
            page.locator(f'[data-ready="{row}"]').click()
        page.locator('.start-countdown').first.filter(has_text='3').wait_for(timeout=10000)
        if count == 2:
            assert page.locator('.start-countdown').nth(1).inner_text() == '3'
        page.screenshot(path=str(out / f'window-{count}-countdown-phone.png'))
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.scene=game.scene.scenes[0]}''')
        page.wait_for_function('scene.playing')
        page.evaluate('scene.paused=true')
        for width, height in [(667,375),(844,390),(1440,900),(1722,1231)]:
            page.set_viewport_size({'width':width,'height':height})
            page.wait_for_timeout(250)
            # HUDs and status belong to the same visible player window.
            for row in range(count):
                window=page.locator(f'[data-player-window="{row}"]').bounding_box()
                for selector in ['.lane-label','.lane-status']:
                    rect=page.locator(f'[data-player-window="{row}"] {selector}').bounding_box()
                    assert rect and rect['y']>=window['y'] and rect['y']+rect['height']<=window['y']+window['height']
                assert page.locator(f'[data-player-window="{row}"] .lane-location').inner_text()
            if count == 1:
                duck=page.locator('[data-duck="0"]').bounding_box()
                cast=page.locator('[data-cast="0"]').first.bounding_box()
                dash=page.locator('[data-dash="0"]').bounding_box()
                jump=page.locator('[data-jump="0"]').bounding_box()
                scene=page.locator('#game').bounding_box()
                assert duck['x']<cast['x']<dash['x']<jump['x']
                assert min(rect['y'] for rect in [duck,cast,dash,jump])>=scene['y']+scene['height']-1
            else:
                game=page.locator('#game').bounding_box()
                for row in range(2):
                    buttons=[page.locator(f'[data-{kind}="{row}"]').first.bounding_box() for kind in ['jump','dash','cast','duck']]
                    assert buttons[0]['y']<buttons[1]['y']<buttons[2]['y']<buttons[3]['y']
                    for rect in buttons:
                        assert rect['width']>=48 and rect['height']>=48
                        assert rect['x']+rect['width']<=game['x'] if row==0 else rect['x']>=game['x']+game['width']
            page.screenshot(path=str(out/f'window-{count}-{width}.png'))
        page.close()
    assert not errors,errors
    browser.close()
    print('Player HUDs, locations, individual countdowns, thumb rows and side rails passed')
