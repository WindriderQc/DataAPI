import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the dashboard
    page.goto("http://localhost:3003/")

    # Wait for the world map canvas to be visible and rendered
    world_map_canvas = page.locator("#worldMap")
    expect(world_map_canvas).to_be_visible(timeout=10000) # Increased timeout for initial load

    # Optional: Add a small delay to ensure the map has fully drawn
    page.wait_for_timeout(2000)

    # Take a screenshot of the dashboard, focusing on the map area
    page.screenshot(path="jules-scratch/verification/dashboard_verification.png")

    print("Dashboard verification screenshot captured.")

    # Close browser
    browser.close()

with sync_playwright() as playwright:
    run(playwright)