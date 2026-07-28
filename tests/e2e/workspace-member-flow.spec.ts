import { expect, test } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
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
  await memberCard.getByRole("button", { name: "儲存會員營運資料" }).click();
  await expect(page.getByText(/本次變更已寫入 Audit Log/)).toBeVisible();

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
