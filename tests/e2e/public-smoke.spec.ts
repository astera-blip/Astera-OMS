import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("public storefront navigation renders without seed fallback", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /泰國 GL|品牌中心|商品/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "立即看商品" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("社群入口");

  await page.getByRole("link", { name: "立即看商品" }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole("heading", { name: "商品列表" })).toBeVisible();
  await expect(page.getByRole("link", { name: "回首頁" })).toBeVisible();

  await page.getByRole("link", { name: "回首頁" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("homepage recommendations use customer copy and responsive product links", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Firestore emulator product seed.");
  await page.goto("/");

  const recommendations = page.getByRole("heading", { name: "推薦商品" }).locator("xpath=../../..");
  await expect(recommendations.getByRole("link", { name: /E2E 流程商品|商品圖片預覽/ }).first())
    .toBeVisible();
  await expect(recommendations).not.toContainText("unknown");
  await expect(recommendations).not.toContainText("sale type");
  await expect(recommendations).toContainText(/代搶|預購|現貨|候補/);
});

test("brand page and footer do not expose disabled or empty social links as clickable", async ({ page }) => {
  await page.goto("/brand");

  await expect(page.getByRole("heading", { name: /品牌中心|代購品牌中心/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "看商品" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("客服資訊");

  const socialLinks = page
    .getByRole("contentinfo")
    .getByRole("link")
    .filter({ hasText: /LINE|Instagram/ });
  const socialLinkCount = await socialLinks.count();

  for (let index = 0; index < socialLinkCount; index += 1) {
    await expect(socialLinks.nth(index)).toHaveAttribute("href", /^https?:\/\//);
  }
});

test("cart page keeps unauthenticated checkout blocked", async ({ page }) => {
  await page.goto("/cart");

  await expect(page.getByRole("heading", { name: "建立訂單" })).toBeVisible();
  await expect(page.getByText(/請先登入|購物車目前沒有商品/)).toBeVisible();
});

test("public legal pages expose current versions and are linked from the footer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "服務條款" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Astera 下單條款" })).toBeVisible();
  await expect(page.getByText(/版本：2026-07-26/)).toBeVisible();

  await page.getByRole("link", { name: "查看隱私權政策" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Astera 隱私權政策" })).toBeVisible();
  await expect(page.getByText(/生效日期/)).toBeVisible();
});
