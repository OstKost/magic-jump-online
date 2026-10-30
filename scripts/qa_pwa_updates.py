"""Exercise two production releases, explicit activation and offline restart."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
release = ['first']

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def send_response(self, code, message=None):
        if code >= 400: print(code, self.path, flush=True)
        super().send_response(code, message)

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/sw.js':
            data = (ROOT / 'dist/sw.js').read_text().replace('magic-jump-', 'magic-jump-' + release[0] + '-')
            body = data.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

class Server(ThreadingHTTPServer):
    request_queue_size = 128

server = Server(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
out = ROOT / 'artifacts/qa'
out.mkdir(parents=True, exist_ok=True)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()
        page.goto(base)
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
        assert page.locator('#pwa-update').is_hidden(), 'First install must not prompt'
        release[0] = 'second'
        page.evaluate('async () => (await navigator.serviceWorker.ready).update()')
        page.locator('#pwa-update').wait_for(state='visible', timeout=60000)
        page.screenshot(path=str(out / 'pwa-update-desktop.png'))
        page.set_viewport_size({'width': 844, 'height': 390})
        page.screenshot(path=str(out / 'pwa-update-phone.png'))
        page.locator('[data-later]').click()
        assert page.locator('#pwa-update').is_hidden()
        assert page.evaluate('async () => !!(await navigator.serviceWorker.ready).waiting')
        page.reload()
        page.locator('#pwa-update').wait_for(state='visible')
        with page.expect_navigation():
            page.locator('[data-update]').click()
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        assert page.locator('#pwa-update').is_hidden()
        assert page.evaluate('async () => !(await navigator.serviceWorker.ready).waiting')
        context.set_offline(True)
        page.reload()
        page.wait_for_timeout(1200)
        page.keyboard.press('Space')
        page.locator('#solo-menu').wait_for(state='visible')
        page.locator('#game canvas').wait_for(state='attached')
        browser.close()
        print('PWA: first install, waiting update, postpone, reload, activation and offline restart passed')
finally:
    server.shutdown()
