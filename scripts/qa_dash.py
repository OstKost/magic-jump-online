import subprocess
import time
from playwright.sync_api import sync_playwright

def run():
    server = subprocess.Popen(
        ['npm', 'run', 'preview', '--', '--port', '4173'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(2)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 844, 'height': 390})
            page = context.new_page()
            page.set_default_timeout(15000)
            page.goto('http://localhost:4173', wait_until='domcontentloaded')
            page.wait_for_timeout(1200)
            page.keyboard.press('Space')
            page.wait_for_timeout(800)

            # Enter solo mode
            page.locator('#solo-menu').click()
            page.wait_for_timeout(400)
            page.locator('[data-difficulty="medium"]').click()
            page.wait_for_timeout(400)
            page.locator('#confirm-character').click()
            page.wait_for_timeout(400)

            # Ready
            page.locator('[data-ready="0"]').click()
            page.wait_for_timeout(4800)

            # Check buttons in solo controls
            duck_btn = page.query_selector('.solo #play-screen .player-controls.sofia .duck-control')
            cast_btn = page.query_selector('.solo #play-screen .player-controls.sofia .cast-control')
            dash_btn = page.query_selector('.solo #play-screen .player-controls.sofia .dash-control')
            jump_btn = page.query_selector('.solo #play-screen .player-controls.sofia .jump')

            assert duck_btn is not None, "duck button missing"
            assert cast_btn is not None, "cast button missing"
            assert dash_btn is not None, "dash button missing"
            assert jump_btn is not None, "jump button missing"

            # Check CSS columns:
            # Duck: col 1, Cast: col 2, Dash: col 4, Jump: col 5
            duck_col = page.evaluate('(el) => window.getComputedStyle(el).gridColumnStart', duck_btn)
            cast_col = page.evaluate('(el) => window.getComputedStyle(el).gridColumnStart', cast_btn)
            dash_col = page.evaluate('(el) => window.getComputedStyle(el).gridColumnStart', dash_btn)
            jump_col = page.evaluate('(el) => window.getComputedStyle(el).gridColumnStart', jump_btn)
            print(f"Columns: Duck={duck_col}, Cast={cast_col}, Dash={dash_col}, Jump={jump_col}")
            assert duck_col == '1', f"Duck col is {duck_col}"
            assert cast_col == '2', f"Cast col is {cast_col}"
            assert dash_col == '4', f"Dash col is {dash_col}"
            assert jump_col == '5', f"Jump col is {jump_col}"

            # Test dash by pressing KeyD
            page.keyboard.press('KeyD')
            page.wait_for_timeout(100)
            dash_disabled = page.evaluate('(el) => el.disabled', dash_btn)
            dash_text = page.evaluate('(el) => el.querySelector("small").textContent', dash_btn)
            print(f"After KeyD: dash disabled={dash_disabled}, text={dash_text}")
            assert dash_disabled, "dash should be disabled on cooldown"

            # Screenshot solo dash
            page.screenshot(path='artifacts/qa/dash-solo.png')

            # Wait for dash cooldown to finish
            page.wait_for_timeout(2200)
            dash_disabled_after = page.evaluate('(el) => el.disabled', dash_btn)
            print(f"After cooldown: dash disabled={dash_disabled_after}")
            assert not dash_disabled_after, "dash should be re-enabled after cooldown"

            # Test cast by pressing KeyA
            page.keyboard.press('KeyA')
            page.wait_for_timeout(60)
            cast_disabled = page.evaluate('(el) => el.disabled', cast_btn)
            print(f"After KeyA: cast disabled={cast_disabled}")
            assert cast_disabled, "cast should be disabled on cooldown"
            page.wait_for_timeout(600)
            cast_disabled_after = page.evaluate('(el) => el.disabled', cast_btn)
            assert not cast_disabled_after, "cast should be re-enabled after 500ms"

            # Check 2-player mode layout
            context_duo = browser.new_context(viewport={'width': 1000, 'height': 530})
            page_duo = context_duo.new_page()
            page_duo.goto('http://localhost:4173', wait_until='domcontentloaded')
            page_duo.wait_for_timeout(1200)
            page_duo.keyboard.press('Space')
            page_duo.wait_for_timeout(600)

            page_duo.locator('#play-menu').click()
            page_duo.wait_for_timeout(400)
            page_duo.locator('[data-difficulty="medium"]').click()
            page_duo.wait_for_timeout(400)
            page_duo.locator('#confirm-character').click()
            page_duo.wait_for_timeout(400)
            page_duo.locator('#confirm-character').click()
            page_duo.wait_for_timeout(400)

            # Ready both
            page_duo.locator('[data-ready="0"]').click()
            page_duo.locator('[data-ready="1"]').click()
            page_duo.wait_for_timeout(4800)

            # Check 2-player controls
            p0_dash = page_duo.query_selector('[data-dash="0"]')
            p1_dash = page_duo.query_selector('[data-dash="1"]')
            p0_cast = page_duo.query_selector('[data-cast="0"]')
            p1_cast = page_duo.query_selector('[data-cast="1"]')
            assert p0_dash is not None and p1_dash is not None, "2P dash buttons missing"
            assert p0_cast is not None and p1_cast is not None, "2P cast buttons missing"

            page_duo.screenshot(path='artifacts/qa/dash-duo.png')
            print("QA Dash tests passed successfully!")
            browser.close()
    finally:
        server.terminate()

if __name__ == '__main__':
    run()
