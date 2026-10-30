"""Browser smoke checks against a running Vite server; requires Playwright + Chrome."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5176')
OUT = ROOT / 'artifacts' / 'qa'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 844, 'height': 390})
    errors = []
    missing = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: missing.append(response.url) if response.status >= 400 else None)
    page.goto(BASE)
    page.wait_for_timeout(1300)
    page.evaluate('''async()=>{
      const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);
      window.qaScene=game.scene.scenes[0];
    }''')
    page.screenshot(path=str(OUT / 'journey-splash.png'))
    page.keyboard.press('Space')
    page.wait_for_timeout(1250)
    assert page.locator('#home').is_visible()
    page.screenshot(path=str(OUT / 'journey-menu.png'))
    page.locator('#play-menu').click()
    page.locator('[data-character="2"]').click()
    page.wait_for_timeout(550)
    page.screenshot(path=str(OUT / 'journey-player1.png'))
    page.locator('#confirm-character').click()
    assert page.locator('[data-character="2"]').is_disabled()
    page.locator('[data-character="3"]').click()
    page.screenshot(path=str(OUT / 'journey-player2.png'))
    page.locator('#confirm-character').click()
    page.wait_for_timeout(650)
    assert page.evaluate('qaScene.level===0 && qaScene.awaitingReady && !qaScene.playing && qaScene.elapsed===0')
    assert page.evaluate('qaScene.runners.map(r=>r.sprite.texture.key)') == ['air', 'earth']
    assert page.evaluate('qaScene.runners.map(r=>r.pet.sprite.texture.key)') == ['eagle', 'fox']
    page.screenshot(path=str(OUT / 'journey-ready.png'))
    page.keyboard.press('w')
    page.wait_for_timeout(1000)
    assert page.evaluate('!qaScene.playing && qaScene.elapsed===0')
    assert page.locator('[data-ready="0"]').is_disabled()
    page.keyboard.press('ArrowUp')
    page.wait_for_timeout(1100)
    assert page.evaluate('qaScene.playing && qaScene.elapsed>0')
    page.keyboard.press('Escape')
    assert page.evaluate('qaScene.paused')
    page.locator('#pause-home').click()
    page.wait_for_timeout(550)
    assert page.locator('#continue').is_enabled()
    assert page.locator('#home-pets [aria-label*="Орёл"]').count() == 1
    page.locator('#continue').click()
    assert page.evaluate('qaScene.playing && !qaScene.paused')
    page.keyboard.press('w')
    page.wait_for_timeout(100)
    assert page.evaluate('qaScene.runners[0].y<0')
    page.screenshot(path=str(OUT / 'journey-running.png'))
    # Accelerate only the scene clock to exercise real round-end transitions.
    page.evaluate('qaScene.elapsed=59999')
    page.wait_for_timeout(650)
    assert page.locator('#result').is_visible()
    assert 'Уровень пройден' in page.locator('#result-title').inner_text()
    page.screenshot(path=str(OUT / 'journey-victory.png'))
    page.locator('#result-next').click()
    assert page.evaluate('qaScene.level===1 && qaScene.awaitingReady && qaScene.elapsed===0')
    page.locator('[data-ready="0"]').click()
    page.locator('[data-ready="1"]').click()
    page.wait_for_timeout(1100)
    assert page.evaluate('qaScene.playing')
    page.evaluate('qaScene.players.forEach(p=>p.lives=0)')
    page.wait_for_timeout(650)
    assert page.locator('#result').is_visible()
    assert page.locator('#result').evaluate('(e)=>e.classList.contains("is-defeat")')
    page.screenshot(path=str(OUT / 'journey-defeat.png'))
    page.locator('#result-next').click()
    assert page.evaluate('qaScene.level===1 && qaScene.awaitingReady && qaScene.players.every(p=>p.lives===3)')
    # All four character textures must be playable; new journeys always start at level 1.
    page.locator('#home-button').click()
    page.locator('#play-menu').click()
    page.locator('#confirm-character').click()
    page.locator('[data-character="1"]').click()
    page.locator('#confirm-character').click()
    assert page.evaluate('qaScene.level===0 && qaScene.runners[0].sprite.texture.key==="sofia" && qaScene.runners[1].sprite.texture.key==="stella"')
    page.locator('[data-jump="0"]').click()
    page.locator('[data-jump="1"]').click()
    page.wait_for_timeout(1100)
    assert page.evaluate('qaScene.playing')
    page.evaluate('qaScene.level=2;qaScene.elapsed=59999')
    page.wait_for_timeout(650)
    assert 'Равновесие восстановлено' in page.locator('#result-title').inner_text()
    page.locator('#result-next').click()
    assert page.locator('#character-select').is_visible()
    # Check complete layouts at phone and desktop sizes.
    for label, width, height in [('portrait',390,844),('small-portrait',375,667),('desktop',1280,800)]:
        page.set_viewport_size({'width':width,'height':height})
        page.goto(BASE)
        page.wait_for_timeout(1000)
        for screen in ['splash','home','character-select']:
            if screen=='home':
                page.locator('#splash').click()
                page.wait_for_timeout(1250)
            elif screen=='character-select':
                page.locator('#play-menu').click()
                page.wait_for_timeout(550)
            page.screenshot(path=str(OUT / f'journey-{screen}-{label}.png'))
            # Screens may scroll on short phones; controls remain reachable.
            assert page.locator(f'#{screen}').evaluate('(e)=>e.scrollWidth<=e.clientWidth'),(screen,label)
    assert not errors, errors
    assert not missing, missing
    browser.close()
    print('PASS: splash, four heroes, pet mapping, separate readiness, keyboard/touch, pause/resume, victory, defeat, retry, next level, finale and responsive layouts.')
