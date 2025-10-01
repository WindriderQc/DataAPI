from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3003")
    # Wait for the map to be rendered, you might need to adjust the selector and timeout
    page.wait_for_selector('#worldMap', timeout=60000)
    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)