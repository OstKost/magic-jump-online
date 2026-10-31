"""Controlled delivery faults exercise real ranking helpers and recovery UI, not replay validation."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('JOURNEY_QA_URL','http://localhost:5176')
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 for width,height in [(667,375),(1440,900)]:
  c=b.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
  c.route('https://fonts.googleapis.com/**',lambda r:r.abort());c.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page=c.new_page();page.goto(BASE);page.locator('#splash').click();page.locator('#home').wait_for(state='visible')
  page.evaluate("async()=>{window.ranking=await import('/src/ranking.ts')}")
  state={'code':500,'posts':0}
  def result(route):
   state['posts']+=1
   route.fulfill(status=state['code'],json={'code':'database_unavailable' if state['code']==500 else 'proof_unavailable','message':'Controlled QA failure','retryable':state['code']==500} if state['code']!=200 else {'ok':True})
  c.route('**/api/results',result)
  page.evaluate("async()=>{await ranking.submitRankingResult({id:'qa-recovery',token:'proof',player:0,name:'Family',score:42,difficulty:'easy'},async(path,body)=>{const {api}=await import('/src/network.ts');return api(path,body)},true)}")
  page.locator('#ranking-menu').click();page.locator('#ranking').wait_for(state='visible');expect(page.locator('.ranking-recovery')).to_contain_text('ожидает отправки')
  page.reload();page.locator('#splash').click();page.locator('#home').wait_for(state='visible');page.locator('#ranking-menu').click();page.locator('#ranking').wait_for(state='visible');expect(page.locator('.ranking-recovery')).to_contain_text('Family')
  state['code']=403
  page.locator('.ranking-recovery button').filter(has_text='Повторить отправку').click()
  expect(page.locator('.ranking-recovery')).to_contain_text('Нужно повторить')
  page.locator('.ranking-recovery').scroll_into_view_if_needed()
  page.screenshot(path=str(OUT/f'recovery-rejected-{width}.png'))
  # Explicit downgrade is the only call permitted to offline publication.
  offline=[]
  c.route('**/api/results/offline',lambda r:(offline.append(r.request.post_data_json),r.fulfill(json={'ok':True})))
  page.locator('.ranking-recovery button').filter(has_text='Опубликовать офлайн').click()
  expect(page.locator('.ranking-recovery')).to_contain_text('В общем рейтинге · офлайн, без проверки')
  assert len(offline)==1
  page.reload();page.locator('#splash').click();page.locator('#home').wait_for(state='visible');page.locator('#ranking-menu').click();page.locator('#ranking').wait_for(state='visible')
  expect(page.locator('.ranking-recovery')).to_contain_text('В общем рейтинге · офлайн, без проверки')
  assert len(offline)==1
  page.locator('.ranking-recovery').scroll_into_view_if_needed()
  page.screenshot(path=str(OUT/f'recovery-published-{width}.png'))
  res=page.evaluate("""async()=>{const ranking=await import('/src/ranking.ts');const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('quota')};try{return await ranking.submitRankingResult({id:'storage',player:0,name:'No save',score:1,difficulty:'easy'},async()=>({}),false)}finally{Storage.prototype.setItem=original}}""")
  assert not res['ok'] and res['state']=='storage-error' and 'Не удалось сохранить' in res['error']
  # Network-offline queued name recovers through the explicit retry without duplicates.
  c.set_offline(True)
  page.evaluate("async()=>{const r=await import('/src/ranking.ts');await r.submitRankingResult({id:'qa-offline',player:1,name:'Offline',score:33,difficulty:'easy'},async()=>({}),false)}")
  expect(page.locator('.ranking-recovery')).to_contain_text('ожидает отправки')
  c.set_offline(False)
  expect(page.locator('.ranking-recovery')).not_to_contain_text('ожидает отправки')
  assert len(offline)==2
  c.close()
 b.close()
print('Recovery: 500, reload, 403, explicit offline, resync, no duplicates and storage failure passed at phone/desktop widths')
