from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the dashboard
    page.goto("http://localhost:3003/")

    # Wait for the world map canvas to be visible
    world_map_canvas = page.locator("#worldMap")
    expect(world_map_canvas).to_be_visible(timeout=15000) # Increased timeout for map loading

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)