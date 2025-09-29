import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # --- 1. Test the Dashboard Page ---
        print("Navigating to Dashboard page...")
        page.goto("http://localhost:3003/")

        # Verify that the API.ipLookUp() call worked by checking the #ip_id element
        ip_info_element = page.locator("#ip_id pre")
        expect(ip_info_element).to_have_text(re.compile(r".+"), timeout=15000)
        print("Dashboard verification successful: TimeZone element is populated.")

        # Take a screenshot of the dashboard
        dashboard_screenshot_path = "jules-scratch/verification/verification-dashboard.png"
        page.screenshot(path=dashboard_screenshot_path)
        print(f"Dashboard screenshot saved to {dashboard_screenshot_path}")

        # --- 2. Test the Tools Page ---
        print("\nNavigating to Tools page...")
        page.goto("http://localhost:3003/tools")

        # Wait for the user select dropdown to be populated
        user_select = page.locator("#user_select")
        # Check that the dropdown is populated by asserting that the second option is visible.
        # This confirms that the list has at least two entries.
        expect(user_select.locator("option").nth(1)).to_be_visible(timeout=10000)
        print("Tools page verification: User dropdown is populated.")

        # Select a user from the dropdown (e.g., the second user)
        # Note: The value is the index, so '1' selects the second option.
        user_select.select_option(index=1)

        # Click the "Select User" button to trigger the form fill
        page.get_by_role("button", name="Select User").click()

        # Verify that the form was filled by checking the email input field
        email_input = page.locator("#userForm #email")
        # We expect the input to have a value that looks like an email address
        expect(email_input).to_have_value(re.compile(r".+@.+\..+"), timeout=10000)
        print("Tools page verification successful: Form was filled after user selection.")

        # Take a screenshot of the tools page
        tools_screenshot_path = "jules-scratch/verification/verification-tools.png"
        page.screenshot(path=tools_screenshot_path)
        print(f"Tools page screenshot saved to {tools_screenshot_path}")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)