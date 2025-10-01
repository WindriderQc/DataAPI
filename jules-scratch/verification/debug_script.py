from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture all console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg.text))

    try:
        # Navigate to the page
        page.goto("http://localhost:3003", timeout=30000, wait_until="domcontentloaded")

        # Wait a generous fixed amount of time for async operations to settle or fail.
        page.wait_for_timeout(5000)

        # Take a screenshot of whatever is there.
        page.screenshot(path="jules-scratch/verification/debug-screenshot.png", full_page=True)
        print("Debug screenshot taken.")

    except Exception as e:
        print(f"An error occurred during navigation or screenshot: {e}")

    finally:
        print("\n--- BROWSER CONSOLE OUTPUT ---")
        if not console_messages:
            print("No console messages were captured.")
        else:
            for msg in console_messages:
                print(msg)
        print("----------------------------\n")
        browser.close()

with sync_playwright() as playwright:
    run(playwright)