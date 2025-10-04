from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the dashboard page
        page.goto("http://localhost:3003")

        # Wait for the world map canvas to be visible to ensure the chart has been rendered
        world_map_canvas = page.locator("#worldMap")
        expect(world_map_canvas).to_be_visible(timeout=15000) # Increased timeout for rendering

        # Also wait for the legend to appear
        legend = page.locator("#worldMapLegend")
        expect(legend).to_be_visible()
        expect(legend).to_contain_text("Legend")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run_verification()