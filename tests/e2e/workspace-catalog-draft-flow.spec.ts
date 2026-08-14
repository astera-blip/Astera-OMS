import { expect, test } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("Partner proposal stays private until Owner approval", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  const suffix = testInfo.project.name.includes("mobile") ? "手機" : "桌機";
  const title = `E2E Partner 商品草稿 ${suffix}`;
  const description = `Owner 核准後公開 ${suffix}`;

  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT ??= "demo-astera-oms";
  process.env.GOOGLE_CLOUD_PROJECT ??= "demo-astera-oms";
  if (getApps().length === 0) initializeApp({ projectId: "demo-astera-oms" });
  const db = getFirestore();
  const originalDocuments = [
    await db.collection("productsInternal").doc("prod_e2e_flow").get(),
    await db.collection("productsPublic").doc("prod_e2e_flow").get(),
    ...(await db.collection("productVariants").where("productId", "==", "prod_e2e_flow").get()).docs,
    ...(await db.collection("saleCampaigns").where("productId", "==", "prod_e2e_flow").get()).docs,
  ];

  try {

  await page.goto("/e2e-auth?next=/workspace/products");
  await page.getByLabel("Email").fill("partner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/products/);
  await expect(page.getByRole("heading", { name: "Partner 營運工作區" })).toBeVisible();

  await page.getByRole("button", { name: /E2E 流程商品/ }).click();
  await page.getByLabel("Public Description（公開說明）").fill(description);
  await page.getByLabel("Campaign Name（活動名稱）").fill(`E2E 草稿活動 ${suffix}`);
  await page.getByLabel("草稿標題").fill(title);
  await page.getByLabel("變更原因").fill("E2E 測試專用");
  await page.getByRole("button", { name: "送出草稿審核" }).click();
  await expect(page.getByText(`已送出 ${title}，等待 Owner 審核。`)).toBeVisible();

  const publicBefore = await db.collection("productsPublic").doc("prod_e2e_flow").get();
  expect(publicBefore.data()?.publicDescription).not.toBe(description);

  await page.goto("/e2e-auth?next=/workspace/catalog-reviews");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/catalog-reviews/);
  let card = page.locator("article").filter({ hasText: title });
  await card.getByLabel("審核原因").fill("請修正後再送審");
  await card.getByRole("button", { name: "駁回草稿" }).click();
  await expect(card.getByText("Rejected（已駁回）")).toBeVisible();

  await page.goto("/e2e-auth?next=/workspace/catalog-reviews");
  await page.getByLabel("Email").fill("partner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  card = page.locator("article").filter({ hasText: title });
  await card.getByRole("button", { name: "載入並修改草稿" }).click();
  await expect(page).toHaveURL(/\/workspace\/products/);
  await expect(page.getByText(/正在修正已駁回草稿/)).toBeVisible();
  await page.getByLabel("變更原因").fill("E2E 修正後再次送審");
  await page.getByRole("button", { name: "送出草稿審核" }).click();
  await expect(page.getByText(`已送出 ${title}，等待 Owner 審核。`)).toBeVisible();

  await page.goto("/e2e-auth?next=/workspace/catalog-reviews");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  card = page.locator("article").filter({ hasText: title });
  await card.getByLabel("審核原因").fill("E2E 核准");
  await card.getByRole("button", { name: "核准並套用" }).click();
  await expect(card.getByText("Approved（已核准）")).toBeVisible();

  await expect.poll(async () => {
    const snapshot = await db.collection("productsPublic").doc("prod_e2e_flow").get();
    return snapshot.data()?.publicDescription;
  }).toBe(description);
  } finally {
    const currentMutableDocuments = [
      ...(await db.collection("productVariants").where("productId", "==", "prod_e2e_flow").get()).docs,
      ...(await db.collection("saleCampaigns").where("productId", "==", "prod_e2e_flow").get()).docs,
    ];
    const originalPaths = new Set(originalDocuments.map((snapshot) => snapshot.ref.path));
    const batch = db.batch();
    currentMutableDocuments
      .filter((snapshot) => !originalPaths.has(snapshot.ref.path))
      .forEach((snapshot) => batch.delete(snapshot.ref));
    originalDocuments.forEach((snapshot) => {
      if (snapshot.exists) batch.set(snapshot.ref, snapshot.data()!);
    });
    await batch.commit();
  }
});
