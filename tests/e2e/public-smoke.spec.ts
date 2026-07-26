import { expect, test } from "@playwright/test";

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
