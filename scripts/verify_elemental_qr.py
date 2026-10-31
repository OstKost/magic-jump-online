import os
import cv2
import base64
import numpy as np
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('artifacts/qa')
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('JOURNEY_QA_URL', 'http://localhost:5173')

def decode_data_url(data_url: str):
    header, encoded = data_url.split(',', 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def test_qr():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        det = cv2.QRCodeDetector()

        # 1. Desktop Splash Screen (with standard 2x DPR)
        print("1. Testing Desktop Splash QR...")
        ctx_desk = browser.new_context(viewport={'width': 1000, 'height': 600}, device_scale_factor=2)
        p_desk = ctx_desk.new_page()
        p_desk.goto(BASE, wait_until='networkidle')
        p_desk.wait_for_timeout(600)

        # Ensure splash QR is visible
        p_desk.wait_for_selector('#splash-qr')
        p_desk.screenshot(path=str(OUT / 'qr_splash_desktop.png'))

        # Save just the QR canvas screenshot
        qr_desk = p_desk.locator('#splash-qr')
        qr_desk.screenshot(path=str(OUT / 'qr_splash_desktop_canvas.png'))

        # Test OpenCV decode on canvas screenshot
        img = cv2.imread(str(OUT / 'qr_splash_desktop_canvas.png'))
        val, pts, _ = det.detectAndDecode(img)
        print(f"Desktop Splash QR decoded value: '{val}'")
        assert '5173' in val or 'http' in val, f"Expected game URL in QR, got: {val}"

        # Test direct canvas dataURL decode
        data_url_desk = p_desk.evaluate("() => document.querySelector('#splash-qr').toDataURL('image/png')")
        val_direct, _, _ = det.detectAndDecode(decode_data_url(data_url_desk))
        print(f"Desktop Splash Direct Canvas decoded value: '{val_direct}'")
        assert '5173' in val_direct or 'http' in val_direct

        # Test clicking copy button: splash should NOT dismiss
        copy_btn = p_desk.locator('#splash-copy-btn')
        copy_btn.click()
        p_desk.wait_for_timeout(300)
        p_desk.screenshot(path=str(OUT / 'qr_splash_desktop_copied.png'))
        
        # Splash must still be visible (not hidden)
        is_splash_visible = p_desk.is_visible('#splash:not([hidden])')
        print(f"Is splash still visible after clicking copy button: {is_splash_visible}")
        assert is_splash_visible, "Splash screen was prematurely dismissed on clicking copy button!"

        ctx_desk.close()

        # 2. Mobile Splash Screen (Portrait 390x844, 2x DPR)
        print("2. Testing Mobile Portrait Splash QR...")
        ctx_mob = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=2)
        p_mob = ctx_mob.new_page()
        p_mob.goto(BASE, wait_until='networkidle')
        p_mob.wait_for_timeout(600)
        p_mob.screenshot(path=str(OUT / 'qr_splash_mobile_portrait.png'))

        # Test QR canvas decode on mobile
        qr_mob = p_mob.locator('#splash-qr')
        qr_mob.screenshot(path=str(OUT / 'qr_splash_mobile_canvas.png'))
        img_mob = cv2.imread(str(OUT / 'qr_splash_mobile_canvas.png'))
        val_mob, _, _ = det.detectAndDecode(img_mob)
        print(f"Mobile Splash QR decoded value: '{val_mob}'")
        assert '5173' in val_mob or 'http' in val_mob, f"Expected game URL in mobile QR, got: {val_mob}"
        ctx_mob.close()

        # 3. Small Mobile Screen (Portrait 375x667)
        print("3. Testing Small Mobile Screen (375x667)...")
        ctx_se = browser.new_context(viewport={'width': 375, 'height': 667}, is_mobile=True, device_scale_factor=2)
        p_se = ctx_se.new_page()
        p_se.goto(BASE, wait_until='networkidle')
        p_se.wait_for_timeout(600)
        p_se.screenshot(path=str(OUT / 'qr_splash_mobile_se.png'))
        ctx_se.close()

        # 4. Short Landscape Screen (667x375)
        print("4. Testing Short Landscape Screen (667x375)...")
        ctx_land = browser.new_context(viewport={'width': 667, 'height': 375}, device_scale_factor=2)
        p_land = ctx_land.new_page()
        p_land.goto(BASE, wait_until='networkidle')
        p_land.wait_for_timeout(600)
        p_land.screenshot(path=str(OUT / 'qr_splash_short_landscape.png'))
        ctx_land.close()

        # 5. Online Room Lobby QR
        print("5. Testing Online Room Lobby QR...")
        ctx_online = browser.new_context(viewport={'width': 1000, 'height': 600}, device_scale_factor=2)
        p_online = ctx_online.new_page()
        
        # Mock room API and WebSocket
        p_online.add_init_script('''
          window.commands=[];
          window.testRoom={code:'4321',id:'room-test',host:'me',phase:'lobby',difficulty:'medium',
            members:[{id:'me',hero:0,ready:false,connected:true}]};
          const NativeSocket=window.WebSocket;
          class MockSocket{static OPEN=1;readyState=1;constructor(url,...protocols){if(!String(url).includes('/api/rooms/'))return new NativeSocket(url,...protocols);window.socket=this;setTimeout(()=>this.onopen?.(),30)}send(raw){commands.push(JSON.parse(raw))}close(){this.readyState=3}}
          window.WebSocket=MockSocket;
          window.deliver=()=>socket.onmessage({data:JSON.stringify(testRoom)});
        ''')
        p_online.route('**/api/rooms', lambda route: route.fulfill(json={'code': '4321', 'id': 'me', 'token': 'test'}))

        p_online.goto(BASE, wait_until='networkidle')
        p_online.wait_for_timeout(400)
        
        # Dismiss splash to enter home
        p_online.keyboard.press('Space')
        p_online.wait_for_timeout(800)
        p_online.wait_for_selector('#home:not([hidden])')

        # Click Online Menu
        p_online.locator('#online-menu').click()
        p_online.wait_for_timeout(800)

        # Click create room (path-create)
        create_btn = p_online.locator('.room-path-create .primary')
        create_btn.click()
        p_online.wait_for_timeout(500)
        p_online.wait_for_function('typeof window.socket?.onmessage==="function"')
        p_online.evaluate('deliver()')

        # Check lobby and room-qr
        p_online.wait_for_selector('#lobby:not([hidden])')
        p_online.screenshot(path=str(OUT / 'qr_room_lobby_desktop.png'))

        room_qr = p_online.locator('#room-qr')
        room_qr.screenshot(path=str(OUT / 'qr_room_lobby_canvas.png'))

        img_room = cv2.imread(str(OUT / 'qr_room_lobby_canvas.png'))
        val_room, _, _ = det.detectAndDecode(img_room)
        print(f"Room Lobby QR decoded value: '{val_room}'")
        assert 'room=4321' in val_room, f"Expected room=4321 in QR screenshot, got: {val_room}"

        # Test direct canvas decode
        data_url_room = p_online.evaluate("() => document.querySelector('#room-qr').toDataURL('image/png')")
        val_room_direct, _, _ = det.detectAndDecode(decode_data_url(data_url_room))
        print(f"Room Lobby Direct Canvas decoded value: '{val_room_direct}'")
        assert 'room=4321' in val_room_direct, f"Expected room=4321 in direct QR, got: {val_room_direct}"

        ctx_online.close()
        browser.close()
        print("ALL QR VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_qr()
