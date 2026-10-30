"""Check the magic root through both jumps and capture desktop/phone frames."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('artifacts/qa')
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    errors = []
    for label, width, height in [('desktop', 1440, 900), ('phone', 844, 390)]:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=label == 'phone', has_touch=label == 'phone')
        context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        context.route('https://fonts.gstatic.com/**', lambda route: route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173'))
        page.locator('#splash').click()
        page.locator('#solo-menu').click()
        page.locator('[data-difficulty="easy"]').click()
        page.locator('#confirm-character').click()
        page.locator('[data-ready="0"]').click(force=True)
        page.evaluate('''async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);window.qaGame=game}''')
        page.wait_for_function('qaGame.scene.scenes[0]?.playing')
        page.evaluate('()=>{window.scene=qaGame.scene.scenes[0]}')
        page.evaluate('''()=>{
          scene.plan=[];
          for(const item of scene.items){item.icon.destroy();item.cueView?.destroy()}
          scene.items=[];
          scene.paused=true;
        }''')
        for stage in ['jump', 'double']:
            result = page.evaluate('''()=>{
              scene.paused=false;
              scene.jump(0);
              scene.paused=true;
              for(let i=0;i<8;i++)scene.step();
              const r=scene.runners[0], trail=r.magic.trail;
              return {jumps:r.jumps, y:r.magic.previousLift, root:trail.at(-1),
                gap:Math.abs(trail.at(-2).y-trail.at(-1).y),
                oldest:Math.max(...trail.map(p=>p.age))};
            }''')
            assert result['jumps'] == (1 if stage == 'jump' else 2), result
            assert abs(result['root']['y'] - (result['y'] - 12)) < .001, result
            assert result['gap'] < 5, result
            assert result['oldest'] < .24, result
            page.wait_for_timeout(60)
            page.screenshot(path=str(OUT / f'magic-{label}-{stage}.png'))
        page.evaluate('()=>{for(let i=0;i<100;i++)scene.step()}')
        assert page.evaluate('scene.runners[0].magic.trail.length') == 0
        context.close()
    assert not errors, errors
    browser.close()
print('Magic jump, double jump and landing checks passed on desktop and phone')
