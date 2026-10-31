"""Browser loading samples against a production URL; no physical-phone claim."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('JOURNEY_QA_URL','http://localhost:8093')
OUT=Path('artifacts/qa');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context(viewport={'width':667,'height':375},service_workers='block');page=c.new_page();samples=[]
 for phase in ['cold','warm','service-worker']:
  if phase=='service-worker':
   c.close();c=b.new_context(viewport={'width':667,'height':375});page=c.new_page();page.goto(BASE);page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=60000)
  page.goto(BASE,wait_until='load');page.locator('#solo-menu').wait_for(state='attached');page.wait_for_timeout(1500)
  sample=page.evaluate('''()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return {navigationMs:n.duration,domContentLoadedMs:n.domContentLoadedEventEnd,resourceCount:r.length,resourceTransferBytes:r.reduce((n,r)=>n+r.transferSize,0),resourceEncodedBytes:r.reduce((n,r)=>n+r.encodedBodySize,0),serviceWorkerControlled:!!navigator.serviceWorker.controller,userAgent:navigator.userAgent}}''')
  sample['phase']=phase;samples.append(sample);page.screenshot(path=str(OUT/f'load-{phase}.png'))
 (OUT/'load-measurement.json').write_text(json.dumps({'url':BASE,'viewport':'667x375','samples':samples,'limitations':'No radio/CPU throttling; 1.5s observation can omit background precache. Resource Timing transferSize is not disk size or total eventual SW traffic.'},indent=2));b.close()
print('Wrote cold/warm/SW samples; interpret with documented limitations')
