import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("mobile storefront navigation expands below the header and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "開啟選單" }).click();
  const menu = page.getByRole("navigation", { name: "會員導覽" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "商品", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "會員登入" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("header cart opens a dismissible summary drawer", async ({ page }) => {
  test.skip(!useEmulatedAuth, "The approved guest header hides the member cart.");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/e2e-auth?next=/");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "購物車" }).first().click();

  const drawer = page.getByRole("dialog", { name: /購物車/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "查看購物車" })).toHaveAttribute("href", "/cart");
  await expect(drawer.getByRole("link", { name: "前往結帳" })).toHaveAttribute("href", "/checkout");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect.poll(() => pageErrors).toEqual([]);
});
