import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Go to the app
        await page.goto("http://127.0.0.1:8000/")

        # 2. Verify language selector in menu
        await expect(page.get_by_role("combobox")).to_be_visible()

        # 3. Start the game
        await page.get_by_role("button", name="開始遊戲").click()

        # 4. Verify elements in game view
        await expect(page.get_by_text("關卡 1")).to_be_visible()

        # Verify language selector
        await expect(page.get_by_role("combobox")).to_be_visible()

        # Verify mic toggle button
        mic_button = page.get_by_role("button", name="點擊說話")
        await expect(mic_button).to_be_visible()

        # Verify transcript display area exists
        # This is a bit tricky since it's just a <p> tag. We'll check for its parent container.
        # The parent div has a class 'relative w-full text-center h-12 mb-2'
        transcript_container = page.locator("div.relative.w-full.text-center.h-12.mb-2")
        await expect(transcript_container).to_be_visible()

        # 5. Take a screenshot
        screenshot_path = "web/jules-scratch/verification/verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
