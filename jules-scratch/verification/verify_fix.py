import os
import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    extension_path = os.path.abspath("Edge-Extension")
    user_data_dir = "/tmp/playwright_user_data"
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)

    context = playwright.chromium.launch_persistent_context(
        user_data_dir,
        headless=True,
        args=[
            "--headless=new",
            f"--disable-extensions-except={extension_path}",
            f"--load-extension={extension_path}",
            '--auto-select-desktop-capture-source=Entire screen'
        ],
    )

    page = None  # Initialize page to None
    try:
        # Use expect_event to reliably wait for the service worker.
        # This is the key to avoiding race conditions.
        print("Waiting for extension service worker...")
        with context.expect_event("serviceworker", timeout=10000) as event_info:
            background_worker = event_info.value
        print("Service worker found.")

        if "background.js" not in background_worker.url:
            raise Exception(f"Incorrect service worker loaded: {background_worker.url}")

        # Now that the extension is ready, create a new page.
        page = context.new_page()
        print("Navigating to test page...")
        page.goto("https://www.google.com", wait_until="load")

        # Give the content script a moment to inject after page load.
        time.sleep(1)

        print("Triggering capture from service worker...")
        # Execute script in the background worker's context to kick things off.
        background_worker.evaluate(
            """
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "initiateCapture" });
                } else {
                    console.error("Test: No active tab found.");
                }
            });
            """
        )

        print("Waiting for modal overlay...")
        # In the page, wait for the UI to appear.
        overlay = page.locator("#text-grab-overlay")
        expect(overlay).to_be_visible(timeout=15000)

        screenshot_img = page.locator("#text-grab-screenshot")
        expect(screenshot_img).to_have_attribute("src", lambda s: s.startswith("data:image/png"))

        print("Taking screenshot...")
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken. Verification successful.")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        if page:
            page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        print("Closing browser context.")
        context.close()

with sync_playwright() as playwright:
    run(playwright)