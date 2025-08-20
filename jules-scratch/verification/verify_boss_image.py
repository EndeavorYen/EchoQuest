from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        # 1. Start the server in the web directory first.
        # It should be running on http://localhost:8000
        page.goto("http://localhost:8000")

        # 2. Click the "開始遊戲" (Start Game) button.
        start_game_button = page.get_by_role("button", name="開始遊戲")
        start_game_button.click()

        # 3. Wait for the game to load and the boss image to be visible.
        # The boss image is the first one with the alt text "巨龍巢穴".
        boss_image = page.get_by_alt_text("巨龍巢穴")
        boss_image.wait_for(state="visible")

        # 4. Take a screenshot.
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
