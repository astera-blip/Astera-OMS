import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8DwH4QZYAwAR8oH+Xm0fdIAAAAASUVORK5CYII=",
  "base64",
);

test("owner uploads and updates a public product image", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore/Storage emulator seed.");
  await page.goto("/e2e-auth?next=/workspace/products");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/products/);
  await expect(page.getByText(/商品資料已載入。|目前沒有商品。/)).toBeVisible();
  const target = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  await page.getByRole("button", { name: new RegExp(`E2E 圖片商品 ${target}`) }).click();
  const productId = `prod_e2e_image_${target}`;
  await expect.poll(async () =>
    (await page.request.post(`/api/workspace/products/${productId}/images/register`)).status(),
  ).toBe(401);

  const manager = page.locator("section").filter({ hasText: "Product Images（商品圖片）" });
  await manager.locator('input[type="file"]').setInputFiles({
    name: `${testInfo.project.name}.png`,
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await expect(manager.getByText("圖片已上傳；第一張圖片會作為商品封面。"))
    .toBeVisible({ timeout: 20_000 });
  const altInput = manager.getByLabel(/Alt Text（替代文字）/).last();
  await altInput.fill(`E2E ${testInfo.project.name} 商品圖片`);
  await manager.getByRole("button", { name: "儲存圖片設定" }).click();
  await expect(manager.getByText(/圖片順序與替代文字已更新/)).toBeVisible();
});
