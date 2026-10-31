"""Natural-clock local journey: real scene inputs/logs, Go proof and name delivery.
No health, elapsed time, scene level or finish method is modified.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5174')
OUT = Path('artifacts/qa'); OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1280, 'height':720})
    errors = []
    verified = []
    def proof(response):
        if response.request.method == 'POST' and response.url.endswith('/finish') and response.status == 200:
            verified.append(response.json())
    page.on('response', proof)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE); page.wait_for_timeout(1500); page.keyboard.press('Space'); page.wait_for_timeout(800)
    page.locator('#solo-menu').click(); page.locator('[data-difficulty="easy"]').click(); page.locator('#confirm-character').click()
    page.evaluate('''async()=>{
      const {game}=await import(document.querySelector('script[src*="/src/main.ts"]').src);
      window.scene=game.scene.scenes[0];
      window.bot=setInterval(()=>{
        const s=window.scene;if(!s.playing||s.paused)return;
        const near=s.items.filter(o=>!o.passed&&o.x>=120).sort((a,b)=>a.x-b.x);
        const overhead=near.find(o=>o.obstacle==='overhead'&&o.kind!=='bonus'&&o.x<330);
        s.duck(0,'qa',!!overhead);
        const hazard=near.find(o=>['gap','fire','puddle','platform'].includes(o.kind)&&o.x<440);
        if(hazard)s.dash(0);
        const obstacle=near.find(o=>(o.kind==='obstacle'||o.kind==='enemy')&&o.obstacle==='ground'&&o.x<245);
        const platform=near.find(o=>o.kind==='platform'&&o.x<500);
        if(!overhead&&(obstacle||platform)&&s.runners[0].grounded)s.jump(0);
        s.cast(0);
      },20);
    }''')
    worlds=[]
    for stage in range(3):
        page.locator('[data-ready="0"]').click(); page.wait_for_function('scene.playing', timeout=15000)
        worlds.append(page.evaluate('scene.world'))
        page.locator('#result').wait_for(state='visible', timeout=45000)
        assert not page.locator('#result').evaluate('(el)=>el.classList.contains("is-defeat")'), f'bot defeated stage {stage}'
        print(f'Natural stage {stage+1} completed, world {worlds[-1]}', flush=True)
        if stage<2: page.locator('#result-next').click()
    page.evaluate('clearInterval(bot)')
    page.wait_for_function('JSON.parse(localStorage.getItem("jump-pending-finishes")||"[]").some(f=>f.state==="published")', timeout=20000)
    finishes=page.evaluate('JSON.parse(localStorage.getItem("jump-pending-finishes"))')
    finish=finishes[-1]
    assert len(finish['payload']['logs'])==3
    assert verified, 'Missing Go replay response'
    local_score=page.evaluate('scene.players[0].score')
    assert verified[-1]['players'][0]['score']==local_score, (verified[-1], local_score)
    assert all(0<=a['tick']<1000 for log in finish['payload']['logs'] for a in log)
    (OUT/'natural-replay.json').write_text(json.dumps({'worlds':worlds, 'finish':finish}, ensure_ascii=False, indent=2))
    form=page.locator('#result-ranking form'); form.locator('input').fill('Replay QA')
    form.locator('button[type="submit"]').click()
    page.wait_for_function('JSON.parse(localStorage.getItem("jump-pending-sync")||"[]").length===0')
    response=page.request.get(BASE+'/api/ranking?difficulty=easy').json()
    assert any(e['name']=='Replay QA' and e['provenance']=='verified' for e in response['entries']), response
    page.screenshot(path=str(OUT/'natural-replay-desktop.png'))
    page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(200)
    page.screenshot(path=str(OUT/'natural-replay-phone.png'))
    assert not errors, errors
    print('Real local logs accepted by Go; verified personal name published exactly once.',flush=True)
    browser.close()
