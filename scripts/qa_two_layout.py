"""Two-player scenery, object scaling and floor speed across viewport sizes."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('artifacts/qa')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 844, 'height': 390})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173'))
    page.wait_for_timeout(1500)
    page.keyboard.press('Space')
    page.wait_for_timeout(800)
    page.locator('#play-menu').click()
    page.locator('[data-difficulty="easy"]').click()
    page.locator('#confirm-character').click()
    page.locator('#confirm-character').click()
    page.evaluate('''async()=>{
      const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);
      window.scene=game.scene.scenes[0];
    }''')
    for row in range(2):
        page.locator(f'[data-ready="{row}"]').click()
    page.wait_for_function('scene.playing')
    page.evaluate('''()=>{
      scene.items.forEach(item=>{item.icon.destroy();item.cueView?.destroy()});
      scene.items=[];
      for(let row=0;row<2;row++) {
        for(const [kind,obstacle,x] of [['obstacle','ground',450],['obstacle','overhead',700],['bonus','none',900]]) {
          scene.spawn({row,kind,obstacle,at:1000,variant:0});
          const item=scene.items.at(-1);item.x=x;item.icon.x=x;
        }
        scene.cast(row);
      }
      scene.paused=true;
    }''')
    for width, height in [(667, 375), (844, 390), (1440, 900), (1722, 1231)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(300)
        page.evaluate('''()=>{
          const s=scene, zoom=s.elementScale;
          const close=(a,b)=>{if(Math.abs(a-b)>1e-6)throw Error(`${a} != ${b}`)};
          for(let row=0;row<2;row++) {
            const scenery=s.background.layers[row].sprite;
            close(scenery.y,row*s.scale.height/2);
            close(scenery.tileScaleX,scenery.tileScaleY);
            close(scenery.tileScaleX,zoom);
            close(s.runners[row].sprite.scaleX,.72*zoom);
            close(s.runners[row].pet.sprite.scaleX,.65*zoom);
            s.runners[row].y=-80;
          }
          s.resizeArena();
          for(let row=0;row<2;row++)close(s.runners[row].sprite.y,s.ground(row)-80*zoom);
          for(const item of s.items) {
            close(item.icon.scaleX,zoom);
            close(item.icon.y,s.ground(item.row)-(item.kind==='bonus'?170*zoom:0));
            s.updateCue(item);
          }
          for(const shot of s.shots) {
            close(shot.icon.scaleX,.7*zoom);
            close(shot.icon.y,s.ground(shot.row)-30*zoom);
          }
          const floor=s.background.layers[2];
          const before=floor.sprite.tilePositionX;
          const item=s.items[0],x=item.x;
          s.step();
          close((floor.sprite.tilePositionX-before)*floor.sprite.tileScaleX,x-item.x);
        }''')
        page.screenshot(path=str(out / f'two-layout-{width}.png'))
    assert not errors, errors
    browser.close()
    print('Two-player scenery, heroes, pets, obstacles, bonuses, jumps and floor speed passed')
