"""Layout-only hazard frames. Keeps lives for observation; never evidence of natural wins."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 for width,height in [(667,375),(1440,900)]:
  page=b.new_page(viewport={'width':width,'height':height});page.goto(os.environ.get('JOURNEY_QA_URL','http://localhost:5176'));page.locator('#splash').click();page.locator('#solo-menu').click();page.locator('[data-difficulty="easy"]').click();page.locator('#confirm-character').click();page.locator('[data-ready="0"]').click()
  page.evaluate("async()=>{const {game}=await import(document.querySelector('script[src*=\\"/src/main.ts\\"]').src);window.scene=game.scene.scenes[0]}")
  page.wait_for_function('scene.playing');page.evaluate('setInterval(()=>scene.players.forEach(p=>p.lives=4),100)')
  page.wait_for_function('scene.elapsed>7000 && scene.items.some(i=>i.x>200&&i.x<600)',timeout=20000)
  page.screenshot(path=str(OUT/f'hazard-{width}.png'));page.close()
 b.close()
print('Phone/desktop hazard layout frames captured; no player comprehension claim')
