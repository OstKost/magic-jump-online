"""Controlled online snapshots exercise 1–3 previews, sizing and controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('artifacts/qa');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':844,'height':390},has_touch=True)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script('''
      window.commands=[];
      window.testRoom={code:'1234',id:'room',host:'me',phase:'playing',difficulty:'easy',
        members:['me','a','b','c'].map((id,i)=>({id,hero:i,ready:true,connected:true})),
        engine:{tick:100,level:0,world:0,players:[0,1,2,3].map(hero=>({hero,lives:4,score:25,y:0,velocity:0,duck:false,connected:true,eligible:true,readyAt:0})),
        items:[0,1,2,3].flatMap(player=>[{player,x:500,kind:'obstacle',obstacle:'ground',variant:0,passed:false},{player,x:800,kind:'bonus',obstacle:'none',variant:0,passed:false}]),projectiles:[]}};
      const NativeSocket=window.WebSocket;
      class Socket{static OPEN=1;readyState=1;constructor(url,...protocols){if(!String(url).includes('/api/rooms/'))return new NativeSocket(url,...protocols);window.socket=this;setTimeout(()=>this.onopen?.(),30)}send(raw){commands.push(JSON.parse(raw))}close(){this.readyState=3}}
      window.WebSocket=Socket;window.deliver=()=>socket.onmessage({data:JSON.stringify(testRoom)});
    ''')
    page.route('**/api/rooms',lambda route:route.fulfill(json={'code':'1234','id':'me','token':'test'}))
    page.goto('http://localhost:5173');page.locator('#splash').click();page.locator('#online-menu').click();page.locator('#create-room').click()
    page.wait_for_function('typeof window.socket?.onmessage==="function"');page.evaluate('deliver()');page.locator('#online-match').wait_for()
    for width,height in [(667,375),(844,390),(1440,900),(1722,1231)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(300)
        assert page.locator('#opponent-lanes canvas').count()==3
        friends=page.locator('#opponent-lanes').bounding_box();own=page.locator('#own-lane').bounding_box();controls=page.locator('.online-controls').bounding_box()
        assert abs(own['width']-width)<1
        assert friends['y']+friends['height']<=own['y']+1
        assert own['y']+own['height']<=controls['y']+1
        rects=[page.locator('#'+name).bounding_box() for name in ['online-duck','online-cast','online-dash','online-jump']]
        assert [r['x'] for r in rects]==sorted(r['x'] for r in rects)
        for rect in rects+[page.locator('#online-back').bounding_box()]:
            assert rect['x']>=0 and rect['x']+rect['width']<=width,(width,rect)
            assert rect['y']>=0 and rect['y']+rect['height']<=height,(height,rect)
        page.screenshot(path=str(out/f'online-window-{width}.png'))
    for previews in [1,2,3]:
        page.evaluate(f"testRoom.members=['me','a','b','c'].slice(0,{previews+1}).map((id,i)=>({{id,hero:i,ready:true,connected:true}}));deliver()")
        assert page.locator('#opponent-lanes canvas').count()==previews
    page.locator('#online-cast').dispatch_event('pointerdown')
    page.locator('#online-dash').dispatch_event('pointerdown')
    assert page.evaluate("commands.some(command=>command.type==='cast') && commands.some(command=>command.type==='dash')")
    page.evaluate('testRoom.engine.players[0].readyAt=3500;deliver()')
    page.wait_for_timeout(100)
    assert page.locator('#online-cast').is_disabled()
    assert not errors,errors
    browser.close();print('Online previews, common window, thumb controls and cooldowns passed')
