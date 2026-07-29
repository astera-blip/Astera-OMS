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
