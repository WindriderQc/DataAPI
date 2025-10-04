from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Go to the dashboard page
        page.goto("http://localhost:3003", timeout=60000)

        # Wait for the legend container to exist first
        legend_container = page.locator("#worldMapLegend")
        expect(legend_container).to_be_visible(timeout=15000)

        # Now, wait for the content *inside* the legend to be rendered.
        # This is a more reliable signal that the async data fetch and chart rendering are complete.
        legend_item = legend_container.locator("li", has_text="No Data")
        expect(legend_item).to_be_visible(timeout=15000)

        # A final static wait for good measure, to ensure all animations are done.
        page.wait_for_timeout(2000)

        # Locate the card containing the map
        map_card = page.locator(".card.shadow-sm", has=page.locator("#worldMap"))
        expect(map_card).to_be_visible()

        # Take the screenshot
        map_card.screenshot(path="jules-scratch/verification/final-world-map.png")

        print("Screenshot saved to jules-scratch/verification/final-world-map.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/final-error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)