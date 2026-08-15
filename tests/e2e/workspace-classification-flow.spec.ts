import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("owner creates, renames, and archives a classification", async ({ page }, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  const suffix = `${testInfo.project.name}-${Date.now()}`.replace(/[^a-zA-Z0-9]/g, "");
  const initialLabel = `Artist ${suffix}`;
  const renamedLabel = `Artist Updated ${suffix}`;

  await page.goto("/e2e-auth?next=/workspace/products");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/products/);
  await expect(page.getByText(/商品資料已載入。|目前沒有商品。/)).toBeVisible();

  await page.getByRole("button", { name: "Classifications（分類管理）" }).click();
  await page.getByRole("button", { name: "Artist（藝人）" }).click();
  await page.getByPlaceholder("新增Artist（藝人）").fill(initialLabel);
  await page.getByRole("button", { name: "新增分類" }).click();
  await expect(page.getByText(`已新增 ${initialLabel}。`)).toBeVisible();

  const nameInput = page.locator(`input[value="${initialLabel}"]`);
  const classificationId = await nameInput.evaluate(
    (input) => input.closest("[data-classification-id]")?.getAttribute("data-classification-id"),
  );
  expect(classificationId).toBeTruthy();
  const row = page.locator(`[data-classification-id="${classificationId}"]`);
  await nameInput.fill(renamedLabel);
  await row.getByLabel("Status（狀態）").selectOption("archived");
  await row.getByRole("button", { name: "儲存變更" }).click();

  await expect(row.getByText(`已儲存 ${renamedLabel}。`)).toBeVisible();
  await expect(row.getByLabel("Status（狀態）")).toHaveValue("archived");
});
