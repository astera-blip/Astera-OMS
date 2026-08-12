import { expect, test } from "@playwright/test";

test("mobile storefront navigation expands below the header and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "開啟選單" }).click();
  const menu = page.getByRole("navigation", { name: "會員導覽" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "商品", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "使用 Google 登入" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("header cart opens a dismissible summary drawer", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "購物車" }).first().click();

  const drawer = page.getByRole("dialog", { name: /購物車/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "查看購物車" })).toHaveAttribute("href", "/cart");
  await expect(drawer.getByRole("link", { name: "前往結帳" })).toHaveAttribute("href", "/checkout");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect.poll(() => pageErrors).toEqual([]);
});
