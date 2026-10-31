"""Controlled failed-room snapshot verifies device-only online defeat naming."""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':667,'height':375},reduced_motion='reduce')
 page.add_init_script('''window.commands=[];const Native=WebSocket;window.WebSocket=class {static OPEN=1;readyState=1;constructor(url,...rest){if(!String(url).includes('/api/rooms/'))return new Native(url,...rest);window.socket=this;setTimeout(()=>this.onopen?.(),10)}send(raw){commands.push(JSON.parse(raw))}close(){this.readyState=3}}''')
 page.route('**/api/rooms',lambda r:r.fulfill(json={'code':'1234','id':'me','token':'token'}))
 page.goto(os.environ.get('JOURNEY_QA_URL','http://localhost:5176'));page.locator('#splash').click();page.locator('#home').wait_for(state='visible');page.locator('#online-menu').click();page.locator('#create-room').click()
 page.wait_for_function('typeof window.socket?.onmessage==="function"')
 page.evaluate('''socket.onmessage({data:JSON.stringify({id:'defeat-room',code:'1234',host:'me',phase:'failed',difficulty:'easy',members:[{id:'me',hero:0,ready:false,connected:true},{id:'friend',hero:1,ready:false,connected:true}],engine:{level:0,tick:123,players:[{score:42,lives:0,hero:0,eligible:true},{score:20,lives:0,hero:1,eligible:true}]}})})''')
 form=page.locator('#online-local-defeat');expect(form).to_contain_text('только на этом устройстве');form.locator('input').fill('Local defeat');form.locator('button').click();expect(form).to_contain_text('Сохранено только на этом устройстве')
 assert page.evaluate("JSON.parse(localStorage.getItem('jump-records-easy'))[0].name")=='Local defeat'
 assert page.evaluate("JSON.parse(localStorage.getItem('jump-pending-sync')||'[]').length")==0
 page.screenshot(path='artifacts/qa/online-defeat-device.png');b.close()
print('Online defeat name saves only on device, without shared queue')
