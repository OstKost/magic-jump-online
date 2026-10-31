"""Stella selection, action clips and phone/desktop smoke checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:5173');page.wait_for_timeout(1500);page.keyboard.press('Space')
    page.locator('#solo-menu').click();page.locator('[data-difficulty="easy"]').click()
    page.locator('[data-character="1"]').click()
    assert page.locator('[data-character]').count()==5
    page.screenshot(path=str(OUT/'stella-selection-desktop.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT/'stella-selection-phone.png'))
    page.set_viewport_size({'width':1280,'height':800})
    page.locator('#confirm-character').click();page.wait_for_timeout(300)
    page.screenshot(path=str(OUT/'stella-idle.png'))
    page.locator('[data-ready="0"]').click();page.wait_for_function('window.adventure.playing')
    page.evaluate('''()=>{const s=window.adventure; s.items.forEach(i=>i.icon.destroy());s.items=[];s.plan=[];s.cast(0);}''')
    page.wait_for_timeout(130);page.screenshot(path=str(OUT/'stella-harmony.png'))
    page.keyboard.press('w');page.wait_for_timeout(120)
    element=page.evaluate('window.adventure.runners[0].v2.jump')
    page.keyboard.press('w');page.wait_for_timeout(120)
    assert page.evaluate('window.adventure.runners[0].v2.jump')==element
    page.screenshot(path=str(OUT/'stella-double-jump.png'))
    assert not errors,errors
    print('Stella browser checks passed')
    browser.close()
