from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Listen for console events and print them
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    try:
        # Go to the dashboard page
        page.goto("http://localhost:3003", timeout=60000)

        # Wait for the world map canvas to be visible
        world_map_canvas = page.locator("#worldMap")
        expect(world_map_canvas).to_be_visible(timeout=30000)

        # Wait for the custom legend to appear
        legend = page.locator("#worldMapLegend")
        expect(legend).to_be_visible(timeout=15000)

        # Give the chart a moment to fully render the colors
        page.wait_for_timeout(2000)

        # Take a screenshot of the card containing the map and legend
        map_card = page.locator(".card-body", has=page.locator("#worldMap"))
        map_card.screenshot(path="jules-scratch/verification/world-map-legend-fixed.png")

        print("Screenshot saved to jules-scratch/verification/world-map-legend-fixed.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error-fixed.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)