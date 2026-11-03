import { test, expect } from "@playwright/test";

test("check rendered elements", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForTimeout(3000);
  const text = await page.innerText("body");
  console.log("BODY TEXT:\n", text);
});
