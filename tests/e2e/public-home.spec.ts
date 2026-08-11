import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("the real public homepage follows the approved buyer-facing hierarchy", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "泰國 GL／藝人周邊代購" })).toBeVisible();
  await expect(page.getByRole("link", { name: "立即看商品" })).toHaveAttribute("href", "#featured-products");
  await expect(page.getByRole("link", { name: "了解購買流程" })).toHaveAttribute("href", "#shopping-guide");
  for (const text of ["Firestore", "Custom Claim", "Owner", "Audit Log", "MVP", "ASTERA OMS"]) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
});

for (const viewport of [
  { name: "phone", width: 390, columns: 2 },
  { name: "tablet", width: 768, columns: 2 },
  { name: "desktop", width: 1365, columns: 4 },
]) {
  test(`homepage product grid is ${viewport.columns} columns without overflow at ${viewport.name}`, async ({ page }) => {
    test.skip(!useEmulatedAuth, "Seeded products are provided by the emulator suite.");
    await page.setViewportSize({ width: viewport.width, height: 900 });
    await page.goto("/");
    const grid = page.getByTestId("featured-product-grid");
    await expect(grid).toBeVisible();
    const columnCount = await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(columnCount).toBe(viewport.columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("a signed-in member resumes a validated guest cart intent", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  await page.addInitScript(() => {
    window.sessionStorage.setItem("astera-pending-cart-intent-v1", JSON.stringify({
      productId: "prod_e2e_flow",
      variantId: "var_e2e_flow_default",
      saleCampaignId: "camp_e2e_flow_preorder",
      quantity: 1,
    }));
  });
  await page.goto("/e2e-auth?next=/");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("登入完成，已將 E2E 流程商品 加入購物車。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.sessionStorage.getItem("astera-pending-cart-intent-v1"))).toBeNull();
});
