import { test, expect } from "@playwright/test";

test.describe("Real-time Live Message Delivery in #general", () => {
  test("Alice sends a message, and Bob sees it within 2 seconds without refresh", async ({ browser }) => {
    // 1. Context 1: Alice (acme-owner by default)
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await alicePage.goto("http://localhost:5173");

    // Wait for Alice to load and connect
    await expect(alicePage.getByText("Alice Chen").first()).toBeVisible({ timeout: 10_000 });
    await expect(alicePage.getByRole("heading", { name: "general" })).toBeVisible({ timeout: 5_000 });

    // 2. Context 2: Bob (switch to acme-admin)
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    await bobPage.goto("http://localhost:5173");

    // Wait for initial load, then switch identity to Bob Martinez
    await expect(bobPage.getByText("Alice Chen").first()).toBeVisible({ timeout: 10_000 });
    await bobPage.locator("button:has-text('Alice Chen')").click();
    await bobPage.locator("[role='menuitem']:has-text('Bob Martinez')").click();

    // Verify Bob is now active
    await expect(bobPage.getByText("Bob Martinez").first()).toBeVisible({ timeout: 5_000 });
    await expect(bobPage.getByRole("heading", { name: "general" })).toBeVisible({ timeout: 5_000 });

    // Wait a brief moment for both WebSockets to subscribe to #general
    await bobPage.waitForTimeout(1000);

    // 3. Alice sends a unique message
    const uniqueText = `Live message from Alice to Bob - ${Date.now()}`;
    const aliceComposer = alicePage.locator("textarea[placeholder*='Message #']");
    await aliceComposer.fill(uniqueText);
    await aliceComposer.press("Enter");

    // 4. Verify Alice sees her sent message in the message list
    const aliceMessage = alicePage.locator("div.group").filter({ hasText: uniqueText });
    await expect(aliceMessage).toBeVisible({ timeout: 2000 });

    // 5. CRITICAL ASSERTION: Bob MUST see the message live within 2 seconds without refresh!
    const startTime = Date.now();
    const bobMessage = bobPage.locator("div.group").filter({ hasText: uniqueText });
    await expect(bobMessage).toBeVisible({ timeout: 2000 });
    const elapsed = Date.now() - startTime;
    console.log(`[E2E SUCCESS] Bob received live message in ${elapsed}ms!`);

    // 6. Verify author resolution: sender is rendered as "Alice Chen", NOT "Team Member"
    await expect(bobMessage.getByText("Alice Chen").first()).toBeVisible({ timeout: 1000 });

    await aliceContext.close();
    await bobContext.close();
  });
});
