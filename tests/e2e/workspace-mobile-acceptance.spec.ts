import { expect, test } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("owner workspace pages do not overflow the Pixel 7 viewport", async ({
  page,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-mobile", "Pixel 7 acceptance only.");
  test.setTimeout(90_000);

  await page.goto("/e2e-auth?next=/workspace");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Operations Workspace" })).toBeVisible();

  for (const path of [
    "/workspace/products",
    "/workspace/members",
    "/workspace/orders",
    "/workspace/payments",
    "/workspace/content",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Operations Workspace" })).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow, `${path} should fit the Pixel 7 viewport`).toBe(false);
  }

  await page.goto("/workspace/products");
  await page.getByRole("button", { name: "Classifications（分類管理）" }).click();
  await expect(page.getByRole("heading", { name: "Classifications（分類管理）" }))
    .toBeVisible();
  const classificationHasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(
    classificationHasOverflow,
    "Classification management should fit the Pixel 7 viewport",
  ).toBe(false);
});

test("helper mobile workspace hides high-risk payment, member, and audit navigation", async ({
  page,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-mobile", "Pixel 7 acceptance only.");

  await page.goto("/e2e-auth?next=/workspace");
  await page.getByLabel("Email").fill("helper-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Operations Workspace" })).toBeVisible();
  const workspaceNavigation = page.getByRole("navigation");
  await expect(workspaceNavigation.getByRole("link", { name: "Products（商品）" }))
    .toBeVisible();
  await expect(workspaceNavigation.getByRole("link", { name: "Orders（訂單）" }))
    .toBeVisible();
  await expect(workspaceNavigation.getByRole("link", { name: "Members（會員）" }))
    .toHaveCount(0);
  await expect(workspaceNavigation.getByRole("link", { name: "Payments（付款）" }))
    .toHaveCount(0);
  await expect(workspaceNavigation.getByRole("link", { name: "Audit Logs（稽核紀錄）" }))
    .toHaveCount(0);
});

test("member mobile session cannot enter the workspace", async ({ page }, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-mobile", "Pixel 7 acceptance only.");

  await page.goto("/e2e-auth?next=/workspace");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "需要後台權限" })).toBeVisible();
  await expect(page.getByText("請使用 owner 或 helper 帳號進入工作區。")).toBeVisible();
});
