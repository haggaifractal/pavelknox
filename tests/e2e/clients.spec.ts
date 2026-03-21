import { test, expect } from '@playwright/test';

test.describe('App Data Validation - Clients Page', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming user is authenticated and navigated to clients page
    // Mock authentication if needed, or rely on global setup
    await page.goto('/clients');
  });

  test('Validates length limits for text fields (101 characters)', async ({ page }) => {
    // Open "Add Client" mode
    await page.click('text=הוסף לקוח');

    // Generate 101 character string
    const longString = 'A'.repeat(101);

    // Try to type more than allowed in input fields (which have native maxLength=100)
    await page.fill('input[type="text"]:has-text("שם הלקוח/ה *")', longString);
    await page.fill('input[type="text"]:has-text("איש קשר")', longString);
    await page.fill('input[type="email"]:has-text("אימייל")', longString);

    // Assert that the native maxLength prevented typing the 101st character
    const nameValue = await page.inputValue('input[type="text"]:has-text("שם הלקוח/ה *")');
    expect(nameValue.length).toBeLessThanOrEqual(100);
  });

  test('Validates Israeli phone numbers', async ({ page }) => {
    await page.click('text=הוסף לקוח');

    // Fill valid mandatory field
    await page.fill('input[type="text"]:has-text("שם הלקוח/ה *")', 'Test Client');

    // Try invalid phone
    await page.fill('input[type="tel"]', '054-invalid');
    await page.click('button:has-text("שמור לקוח/ה")');

    // Expect the action error message to appear
    await expect(page.locator('text=מספר טלפון לא תקין')).toBeVisible();

    // Fix the phone to valid Israeli number
    await page.fill('input[type="tel"]', '0541234567');
    await page.click('button:has-text("שמור לקוח/ה")');

    // Wait for the error to disappear or success state
    await expect(page.locator('text=מספר טלפון לא תקין')).toBeHidden();
  });
});
