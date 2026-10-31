import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173')
OUT = Path('artifacts/qa')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 1. Desktop Splash & Arcade text
    print("Testing Desktop Splash...")
    ctx = browser.new_context(viewport={'width': 1000, 'height': 600})
    page = ctx.new_page()
    page.goto(BASE, wait_until='domcontentloaded')
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / 'verify_splash_desktop.png'))

    # 2. Open Menu, observe fireflies
    print("Opening Menu on Desktop...")
    page.keyboard.press('Space')
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT / 'verify_home_fireflies_desktop_1.png'))
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / 'verify_home_fireflies_desktop_2.png'))

    # 3. Test Exit button returning to Splash
    print("Testing Exit button returning to Splash...")
    page.locator('#exit-menu').click()
    page.wait_for_timeout(1500) # Wait for confirmation blink + transition
    page.wait_for_selector('#splash:not([hidden])')
    page.screenshot(path=str(OUT / 'verify_exit_returns_splash.png'))

    # Click splash again to return to home
    page.keyboard.press('Space')
    page.wait_for_timeout(700)
    page.wait_for_selector('#home:not([hidden])')

    ctx.close()

    # 4. Mobile Portrait (390 x 844)
    print("Testing Mobile Portrait Splash & Home...")
    ctx_mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m_page = ctx_mobile.new_page()
    m_page.goto(BASE, wait_until='domcontentloaded')
    m_page.wait_for_timeout(800)
    m_page.screenshot(path=str(OUT / 'verify_splash_mobile.png'))

    m_page.locator('.press-any').click()
    m_page.wait_for_selector('#home:not([hidden])')
    m_page.wait_for_timeout(800)
    m_page.screenshot(path=str(OUT / 'verify_home_mobile.png'))

    # Test exit on mobile
    m_page.locator('#exit-menu').click()
    m_page.wait_for_timeout(1500)
    m_page.wait_for_selector('#splash:not([hidden])')
    m_page.screenshot(path=str(OUT / 'verify_exit_mobile.png'))

    ctx_mobile.close()

    # 5. Test gameplay level victory run-off animation and banner
    print("Testing Gameplay Victory Run-Off...")
    ctx_game = browser.new_context(viewport={'width': 1000, 'height': 600})
    g_page = ctx_game.new_page()
    g_page.goto(BASE, wait_until='domcontentloaded')
    g_page.wait_for_timeout(1000)
    g_page.keyboard.press('Space')
    g_page.wait_for_selector('#home:not([hidden])')
    g_page.wait_for_timeout(500)

    # Click Solo menu
    g_page.locator('#solo-menu').click()
    g_page.wait_for_selector('#difficulty-select:not([hidden])')
    g_page.locator('[data-difficulty="easy"]').click()
    g_page.wait_for_selector('#character-select:not([hidden])')
    g_page.locator('#confirm-character').click()
    g_page.wait_for_selector('#play-screen:not([hidden])')

    # Click ready to start race
    g_page.locator('[data-ready="0"]').click()

    # Wait for countdown to finish and game to start actively playing
    g_page.wait_for_function('window.adventure && window.adventure.playing')
    g_page.wait_for_timeout(1000)

    # Trigger victory run-off via adventure instance
    g_page.evaluate("""() => {
      const adv = window['adventure'];
      adv.startLevelVictory();
    }""")

    g_page.wait_for_timeout(400)
    g_page.screenshot(path=str(OUT / 'verify_level_cleared_banner.png'))

    g_page.wait_for_timeout(1200)
    g_page.screenshot(path=str(OUT / 'verify_level_cleared_runoff.png'))

    # Wait for transition to result screen
    g_page.wait_for_selector('#result:not([hidden])', timeout=6000)
    g_page.screenshot(path=str(OUT / 'verify_result_after_runoff.png'))

    ctx_game.close()
    browser.close()
    print("All QA checks captured successfully!")
