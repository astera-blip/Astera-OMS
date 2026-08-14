import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("workspace product editor remains behind the workspace auth gate", async ({ page }) => {
  test.skip(useEmulatedAuth, "Covered by authenticated owner workspace test in emulator mode.");

  await page.goto("/workspace/products");

  await expect(page.getByRole("heading", { name: "需要後台權限" })).toBeVisible();
  await expect(page.getByText("請使用 Owner 帳號進入工作區。")).toBeVisible();
  await expect(page.getByRole("button", { name: "使用 Google 登入" })).toBeVisible();
});

test("owner can edit multiple variants and campaigns in emulator mode", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  await page.addInitScript(() => {
    window.localStorage.setItem("astera-products-workspace-v1", JSON.stringify([
      {
        product: {
          id: "prod_ui_001",
          sku: "AST-P000001",
          name: "UI 測試商品",
          publicDescription: "多規格與多活動 smoke test",
          publishState: "draft",
          createdAt: "2026-07-27T00:00:00.000Z",
          createdBy: "system",
        },
        variants: [
          {
            id: "var_ui_001",
            productId: "prod_ui_001",
            sku: "AST-P000001-V001",
            name: "壓克力立牌",
            isDefault: true,
            priceTwd: 680,
            createdAt: "2026-07-27T00:00:00.000Z",
            createdBy: "system",
          },
        ],
        campaigns: [
          {
            id: "camp_ui_001",
            productId: "prod_ui_001",
            title: "首批預購",
            saleType: "preorder",
            status: "open",
            salePriceTwd: 650,
            requiresSupplement: true,
            createdAt: "2026-07-27T00:00:00.000Z",
            createdBy: "system",
          },
        ],
      },
    ]));
  });

  await page.goto("/e2e-auth?next=/workspace/products");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/products/);

  await expect(page.getByRole("heading", { name: "Products（商品管理）" })).toBeVisible();
  await expect(page.getByText(/商品資料已載入。|目前沒有商品。/)).toBeVisible();
  await expect(page.getByText("Product ID（商品識別碼）")).toBeVisible();
  await expect(page.getByText("Product SKU（商品編號）")).toBeVisible();
  await expect(page.getByText("Internal Note（內部備註）")).toBeVisible();
  await expect(page.getByText("Publish Status（刊登狀態）")).toBeVisible();
  await expect(page.getByRole("option", { name: "THB（泰銖）" }).first()).toBeAttached();
  const variantLabels = page.getByText(/^Variant（規格） \d+$/);
  const campaignLabels = page.getByText(/^Campaign（活動） \d+$/);
  const variantCount = await variantLabels.count();
  const campaignCount = await campaignLabels.count();
  const variantsFieldset = page.locator("fieldset").filter({ hasText: "Variants" });
  const campaignsFieldset = page.locator("fieldset").filter({ hasText: "Campaigns" });

  await variantsFieldset.getByRole("button", { name: "新增 Variant（規格）" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await campaignsFieldset.getByRole("button", { name: "新增 Campaign（活動）" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });

  await expect(variantLabels).toHaveCount(variantCount + 1);
  await expect(campaignLabels).toHaveCount(campaignCount + 1);
  await expect(page.getByPlaceholder("未填則用 Variant 售價").last()).toBeVisible();
  await expect(page.getByRole("option", { name: "Rush Purchase（代搶）" }).first()).toBeAttached();
  await expect(page.getByRole("option", { name: "Archived（已封存）" }).first()).toBeAttached();
});

test("member account cannot enter owner workspace in emulator mode", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  await page.goto("/e2e-auth?next=/workspace/products");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "需要後台權限" })).toBeVisible();
  await expect(page.getByText("請使用 Owner 帳號進入工作區。")).toBeVisible();
});
