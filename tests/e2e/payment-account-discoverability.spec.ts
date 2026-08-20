import { expect, test, type Page } from "@playwright/test";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const password = "Password123!";

test("Owner can reach the existing receiving-account manager from workspace navigation", async ({
  page,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Owner navigation runs once.");

  await signIn(page, "owner-e2e@example.test", "/workspace");
  await page.getByRole("link", { name: "付款與收款 Payments" }).click();

  await expect(page).toHaveURL(/\/workspace\/payments$/);
  await expect(page.getByRole("heading", { name: "收款銀行帳戶" })).toBeVisible();
  await expect(page.getByText("E2E 測試銀行／測試分行")).toBeVisible();
  await expect(page.getByText(/帳號末五碼 67890/)).toBeVisible();
});

test("Member can reach and manage payment accounts from normal desktop and mobile navigation", async ({
  page,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  await signIn(page, "member-e2e@example.test", "/");
  if (testInfo.project.name === "chromium-mobile") {
    const menuButton = page.getByRole("button", { name: "開啟選單" });
    await expect(async () => {
      if (await menuButton.getAttribute("aria-expanded") !== "true") {
        await menuButton.click();
      }
      await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    }).toPass();
    const menu = page.getByRole("navigation", { name: "會員導覽" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "付款設定", exact: true }).click();
  } else {
    await page.getByRole("link", { name: "付款設定", exact: true }).click();
  }

  await expect(page).toHaveURL(/\/account\/bank-accounts$/);
  await expect(page.getByRole("heading", { name: "我的匯款帳戶" })).toBeVisible();
  await expect(page.getByText("帳號 ***12345")).toBeVisible();
  await expect(page.getByText("匯款人 測試會員甲")).toBeVisible();

  await page.goto("/payments");
  await expect(page.getByRole("heading", { name: "匯款回報" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理付款帳戶" })).toHaveAttribute(
    "href",
    "/account/bank-accounts",
  );
  const accountSelect = page.getByLabel("匯出匯款的會員帳戶");
  await expect(accountSelect).not.toHaveValue("");
  await expect(accountSelect.locator('option[value="member-e2e-account"]')).toContainText(
    "***12345",
  );
});

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/e2e-auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll("/", "\\/")}$`));
}
