import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("the real guest homepage follows the approved member-store hierarchy", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "泰國 GL／藝人周邊代購" })).toBeVisible();
  await expect(page.getByTestId("guest-login-card")).toBeVisible();
  await expect(page.getByTestId("shopping-steps-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: "正在販售" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "即將結單" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最新商品" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "購買前想先確認？" })).toHaveCount(0);
  await expect(page.getByText("Astera 二補規則", { exact: true })).toHaveCount(0);

  const header = page.getByRole("banner");
  const mobileMenuButton = header.getByRole("button", { name: "開啟選單" });
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click();
  }
  await expect(header.getByRole("button", { name: "會員登入" })).toBeVisible();
  await expect(header.getByRole("button", { name: "購物車" })).toHaveCount(0);
  for (const text of ["Firestore", "Custom Claim", "Owner", "Audit Log", "MVP", "ASTERA OMS"]) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
});

for (const viewport of [
  { name: "phone", width: 390, groupColumns: 1 },
  { name: "tablet", width: 768, groupColumns: 1 },
  { name: "desktop", width: 1365, groupColumns: 2 },
]) {
  test(`homepage selling groups and product cards fit without overflow at ${viewport.name}`, async ({ page }) => {
    test.skip(!useEmulatedAuth, "Seeded products are provided by the emulator suite.");
    await page.setViewportSize({ width: viewport.width, height: 900 });
    await page.goto("/");
    for (const testId of ["closing-soon-grid", "latest-product-grid"]) {
      const grid = page.getByTestId(testId);
      await expect(grid).toBeVisible();
      const columnCount = await grid.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      );
      expect(columnCount).toBe(2);
    }
    const groupColumns = await page.getByTestId("selling-groups").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(groupColumns).toBe(viewport.groupColumns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("a signed-in member sees actions before product sections", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  await page.goto("/e2e-auth?next=/");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "需要你處理" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "最新商品" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "即將結單" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "泰國 GL／藝人周邊代購" })).toHaveCount(0);
});

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
