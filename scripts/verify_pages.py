import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173')
OUT = Path('artifacts/qa')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 1. Desktop / Landscape mode
    ctx = browser.new_context(viewport={'width': 1000, 'height': 600})
    page = ctx.new_page()
    page.goto(BASE, wait_until='domcontentloaded')
    page.wait_for_timeout(800)
    page.keyboard.press('Space')
    page.wait_for_timeout(600)

    # Open Settings
    print("Testing Settings Screen...")
    page.locator('#settings-open').click()
    page.wait_for_selector('#settings:not([hidden])')
    page.screenshot(path=str(OUT / 'page_settings_desktop.png'))

    # Toggle sound and vibration
    page.locator('#sound').click()
    page.locator('#vibration').click()
    page.screenshot(path=str(OUT / 'page_settings_toggled.png'))

    # Open Install page from settings
    print("Testing Install Screen from Settings...")
    page.locator('#install-settings').click()
    page.wait_for_selector('#install:not([hidden])')
    page.screenshot(path=str(OUT / 'page_install_desktop.png'))

    # Switch tabs on Install page
    print("Testing Install Tabs...")
    page.locator('[data-tab="ios"]').click()
    page.screenshot(path=str(OUT / 'page_install_ios.png'))

    page.locator('[data-tab="desktop"]').click()
    page.screenshot(path=str(OUT / 'page_install_pc.png'))

    page.locator('[data-tab="android"]').click()
    page.screenshot(path=str(OUT / 'page_install_android.png'))

    # Return to home
    page.locator('#install .back-home').first.click()
    page.wait_for_selector('#home:not([hidden])')

    # Test opening Install from main menu
    print("Testing Install from Main Menu...")
    page.locator('#install-menu').click()
    page.wait_for_selector('#install:not([hidden])')
    page.locator('#install .back-home').first.click()
    page.wait_for_selector('#home:not([hidden])')

    # Test Ranking Screen
    print("Testing Ranking Screen...")
    page.locator('#ranking-menu').click()
    page.wait_for_selector('#ranking:not([hidden])')
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / 'page_ranking_desktop.png'))

    page.locator('#ranking-reload').click()
    page.wait_for_timeout(400)

    # Back home
    page.locator('#ranking .back-home').first.click()
    page.wait_for_selector('#home:not([hidden])')
    ctx.close()

    # 2. Mobile Portrait mode (Phone)
    print("Testing Mobile Portrait...")
    ctx_mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m_page = ctx_mobile.new_page()
    m_page.goto(BASE, wait_until='domcontentloaded')
    m_page.wait_for_timeout(800)
    m_page.keyboard.press('Space')
    m_page.wait_for_timeout(600)

    # Settings mobile
    m_page.locator('#settings-open').click()
    m_page.wait_for_selector('#settings:not([hidden])')
    m_page.screenshot(path=str(OUT / 'page_settings_mobile.png'), full_page=True)

    # Install mobile
    m_page.locator('#install-settings').click()
    m_page.wait_for_selector('#install:not([hidden])')
    m_page.screenshot(path=str(OUT / 'page_install_mobile.png'), full_page=True)

    # Ranking mobile
    m_page.locator('#install .back-home').first.click()
    m_page.wait_for_selector('#home:not([hidden])')
    m_page.locator('#ranking-menu').click()
    m_page.wait_for_selector('#ranking:not([hidden])')
    m_page.wait_for_timeout(500)
    m_page.screenshot(path=str(OUT / 'page_ranking_mobile.png'), full_page=True)

    ctx_mobile.close()
    browser.close()
    print("All verification screenshots captured successfully!")
