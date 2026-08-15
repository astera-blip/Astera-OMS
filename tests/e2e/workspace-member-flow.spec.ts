import { expect, test } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test.setTimeout(60_000);
test.describe.configure({ mode: "serial" });

test("owner reviews duplicate phones and saves audited member risk details", async ({
  page,
}) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  await page.goto("/e2e-auth?next=/workspace/members");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/workspace/members",
    { timeout: 20_000 },
  );
  await expect(page.getByRole("heading", { name: "疑似重複會員" })).toBeVisible();
  await expect(page.getByText("0922222222：Member Duplicate E2E、Member E2E")).toBeVisible();

  const memberCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Member E2E" }),
  });
  await memberCard.getByLabel("Risk Status（風險狀態）").selectOption("watch");
  await memberCard.getByLabel("Internal Note（內部備註）").fill("需要人工確認重複手機");
  await memberCard.getByRole("button", { name: "儲存風險狀態與內部備註" }).click();
  await expect(memberCard.getByText("已儲存風險狀態與內部備註。")).toBeVisible();

  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT ??= "demo-astera-oms";
  process.env.GOOGLE_CLOUD_PROJECT ??= "demo-astera-oms";
  if (getApps().length === 0) {
    initializeApp({ projectId: "demo-astera-oms" });
  }
  const db = getFirestore();
  const note = await db.collection("memberPrivateNotes").doc("member-e2e").get();
  expect(note.data()).toMatchObject({
    uid: "member-e2e",
    riskState: "watch",
    internalNote: "需要人工確認重複手機",
  });
  const audit = await db.collection("auditLogs").get();
  expect(audit.docs.some((document) => {
    const data = document.data();
    return data.targetId === "member-e2e" && data.action === "member.risk.updated";
  })).toBe(true);
});

test("member cannot open member operations workspace", async ({ page }) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  await page.goto("/e2e-auth?next=/workspace/members");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/workspace/members",
    { timeout: 20_000 },
  );
  await expect(page.getByRole("heading", { name: "需要後台權限" })).toBeVisible();
  await expect(page.getByText("僅 Owner 可查看會員營運資料。")).not.toBeVisible();
});

test("Owner assigns and restores a role with audit, notice, and Workspace denial", async ({ page }, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Run the stateful role lifecycle once.");

  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT ??= "demo-astera-oms";
  process.env.GOOGLE_CLOUD_PROJECT ??= "demo-astera-oms";
  if (getApps().length === 0) initializeApp({ projectId: "demo-astera-oms" });
  const auth = getAuth();
  const db = getFirestore();
  await auth.setCustomUserClaims("role-target-e2e", { role: "member" });

  await page.goto("/e2e-auth?next=/workspace/members");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/workspace/members");

  await page.getByLabel("Role Target E2E 指派角色").selectOption("helper");
  const dialog = page.getByRole("alertdialog", { name: "確認變更角色" });
  await expect(dialog).toContainText("Member（會員）");
  await expect(dialog).toContainText("Helper（小幫手）");
  await dialog.getByRole("button", { name: "確認變更角色" }).click();
  await expect(page.getByText(/已將 Role Target E2E 設為 Helper/)).toBeVisible();
  expect((await auth.getUser("role-target-e2e")).customClaims?.role).toBe("helper");
  const roleAudits = await db.collection("auditLogs").where("targetId", "==", "role-target-e2e").get();
  expect(roleAudits.docs.some((doc) => doc.data().nextRole === "helper")).toBe(true);
  const notices = await db.collection("roleChangeNotifications").where("memberUid", "==", "role-target-e2e").get();
  expect(notices.docs.some((doc) => doc.data().nextRole === "helper" && doc.data().acknowledgedAt === null)).toBe(true);
  await page.goto("/e2e-auth?next=/workspace");
  await page.getByLabel("Email").fill("role-target-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  const notificationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/member/role-notifications") && response.request().method() === "GET");
  await page.getByRole("button", { name: "Sign in" }).click();
  const notificationPayloadResponse = await notificationResponse;
  expect(notificationPayloadResponse.status()).toBe(200);
  await page.waitForURL((url) => url.pathname === "/workspace");
  await expect(page.getByText(/你的帳號角色已更新為 Helper/)).toBeVisible();
  await page.getByRole("button", { name: "我知道了" }).click();
  await expect(page.getByRole("heading", { name: "需要後台權限" })).toBeVisible();

  await page.goto("/e2e-auth?next=/workspace/members");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Role Target E2E 指派角色").selectOption("member");
  await page.getByRole("alertdialog").getByRole("button", { name: "確認變更角色" }).click();
  await expect(page.getByText(/已將 Role Target E2E 設為 Member/)).toBeVisible();
  expect((await auth.getUser("role-target-e2e")).customClaims?.role).toBe("member");
});
