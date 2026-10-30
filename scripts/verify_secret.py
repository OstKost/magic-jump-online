import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create page with localStorage clear
        context = await browser.new_context(viewport={'width': 1200, 'height': 800})
        page = await context.new_page()
        
        # Clear secret_heroes_unlocked before test
        await page.goto('http://localhost:5173')
        await page.evaluate("localStorage.removeItem('secret_heroes_unlocked')")
        await page.reload()
        
        # Click splash
        await page.click('#splash')
        await page.wait_for_selector('#home', state='visible')
        
        # Click Play
        await page.click('#play-menu')
        await page.wait_for_selector('#difficulty-select', state='visible')
        
        # Select Medium difficulty
        await page.click('[data-difficulty="medium"]')
        await page.wait_for_selector('#character-select', state='visible')
        
        # Check initial cards count: should be 4
        cards = await page.query_selector_all('.character-card')
        print(f"Initial character cards count: {len(cards)}")
        assert len(cards) == 4, f"Expected 4 cards initially, got {len(cards)}"
        
        # Click Stella 4 times (not yet unlocked)
        for i in range(4):
            await page.click('[data-character="1"]')
            await page.wait_for_timeout(100)
            
        cards = await page.query_selector_all('.character-card')
        assert len(cards) == 4, "Cards should still be 4 after 4 clicks"
        
        # 5th click on Stella -> secret unlock!
        await page.click('[data-character="1"]')
        await page.wait_for_timeout(200)
        
        cards = await page.query_selector_all('.character-card')
        print(f"Cards count after 5 clicks: {len(cards)}")
        assert len(cards) == 6, f"Expected 6 cards after 5 clicks, got {len(cards)}"
        
        # Check secret banner
        banner = await page.query_selector('#secret-banner')
        assert banner is not None
        banner_visible = await banner.is_visible()
        banner_text = await banner.inner_text()
        print(f"Secret banner text: {banner_text}, visible: {banner_visible}")
        assert "Кай и Лея" in banner_text
        
        # Check that Kai and Leya cards exist
        names = []
        for c in cards:
            name_el = await c.query_selector('.character-name')
            if name_el:
                names.append(await name_el.inner_text())
        print(f"Character names in grid: {names}")
        assert "Кай" in names
        assert "Лея" in names
        
        # Screenshot character select
        await page.screenshot(path='artifacts/qa/secret_character_select.png')
        print("Saved screenshot to artifacts/qa/secret_character_select.png")
        
        # Player 1 chooses Kai (index 4)
        kai_btn = await page.query_selector('[data-character="4"]')
        await kai_btn.click()
        await page.click('#confirm-character')
        await page.wait_for_timeout(200)
        
        # Player 2 chooses Leya (index 5)
        leya_btn = await page.query_selector('[data-character="5"]')
        await leya_btn.click()
        await page.click('#confirm-character')
        await page.wait_for_timeout(500)
        
        # Check ready screen
        ready_overlay = await page.query_selector('#overlay')
        assert await ready_overlay.is_visible()
        ready_cards = await page.query_selector_all('.ready-card')
        assert len(ready_cards) == 2
        p1_title_el = await ready_cards[0].query_selector('.eyebrow')
        p2_title_el = await ready_cards[1].query_selector('.eyebrow')
        p1_title = await p1_title_el.inner_text() if p1_title_el else ''
        p2_title = await p2_title_el.inner_text() if p2_title_el else ''
        print(f"Ready screen: P1='{p1_title}', P2='{p2_title}'")
        assert "Кай" in p1_title
        assert "Лея" in p2_title
        
        # Click ready for both players
        await page.click('[data-ready="0"]')
        await page.wait_for_timeout(200)
        await page.click('[data-ready="1"]')
            
        await page.wait_for_timeout(1000)
        
        # Screenshot gameplay
        await page.screenshot(path='artifacts/qa/secret_gameplay.png')
        print("Saved screenshot to artifacts/qa/secret_gameplay.png")
        
        # Check localStorage persistence on reload
        unlocked = await page.evaluate("localStorage.getItem('secret_heroes_unlocked')")
        print(f"localStorage secret_heroes_unlocked: {unlocked}")
        assert unlocked == 'true'
        
        await browser.close()
        print("ALL QA CHECKS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    asyncio.run(main())
