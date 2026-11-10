import { expect, test } from "@playwright/test";

// Placeholder until Phase 11 populates the nine scenarios in Section 11.6.
test("landing page responds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
