import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

test("owner safely selects and recognizes Taishin Excel matches", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Financial mutation runs once.");

  const db = adminDb();
  const key = `recon_${Date.now()}`;
  await Promise.all([
    seedPaymentGroup(db, `${key}_a`, 520, "10001"),
    seedPaymentGroup(db, `${key}_b`, 880, "10002"),
  ]);
  const workbook = await taishinWorkbook([
    ["2026/08/13 09:30:00", "2026/08/13", "CD轉入", 520, 100000, "ATM 001-000000010001"],
    ["2026/08/13 09:31:00", "2026/08/13", "CD轉入", 880, 100880, "ATM 001-000000010002"],
    ["2026/08/13 09:32:00", "2026/08/13", "CD轉入", 999, 101879, "ATM 001-000000099999"],
  ]);

  await page.goto("/e2e-auth?next=/workspace/payments");
  await page.getByLabel("Email").fill("owner-e2e@example.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace\/payments/);

  const board = page.getByRole("heading", { name: "台新 Excel 批次對帳" }).locator("..");
  await board.locator('input[type="file"]').setInputFiles({
    name: "taishin-e2e.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  await board.getByRole("button", { name: "解析並批次比對" }).click();
  await expect(board.getByText("已比對 3 筆銀行交易，可安全勾選 2 筆。")).toBeVisible();
  await expect(board.getByText("未找到", { exact: true }).first()).toBeVisible();

  await board.getByRole("button", { name: "全選可認列項目" }).click();
  const safeChecks = board.locator('input[type="checkbox"]:not(:disabled)');
  await expect(safeChecks).toHaveCount(2);
  await expect(safeChecks.nth(0)).toBeChecked();
  await expect(safeChecks.nth(1)).toBeChecked();
  await safeChecks.first().uncheck();
  await expect(board.getByText("已選 1 筆")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await board.getByRole("button", { name: "批次確認認列" }).click();
  await expect(board.getByText("批次認列完成：1 筆成功，0 筆失敗。")).toBeVisible();

  const statuses = await Promise.all([
    db.collection("payments").doc(`${key}_a_payment`).get(),
    db.collection("payments").doc(`${key}_b_payment`).get(),
  ]);
  expect(statuses.map((snapshot) => snapshot.data()?.status).sort()).toEqual([
    "confirmed",
    "pendingReview",
  ]);

  await board.getByRole("button", { name: "解析並批次比對" }).click();
  await expect(board.getByText("疑似重複")).toBeVisible();
});

function adminDb() {
  if (getApps().length === 0) initializeApp({ projectId: "demo-astera-oms" });
  return getFirestore();
}

async function seedPaymentGroup(
  db: ReturnType<typeof getFirestore>,
  id: string,
  amountTwd: number,
  accountLast5: string,
) {
  const orderId = `${id}_order`;
  const requestId = `${id}_request`;
  const paymentId = `${id}_payment`;
  await Promise.all([
    db.collection("orders").doc(orderId).set({
      id: orderId, orderNumber: `AST-20260813-${id.slice(-4)}`, memberUid: "member-e2e",
      totalTwd: amountTwd, status: "awaitingPayment", createdAt: new Date(), createdBy: "member-e2e",
    }),
    db.collection("orderItems").doc(`${id}_item`).set({
      id: `${id}_item`, orderId, memberUid: "member-e2e", status: "awaitingPayment",
      quantity: 1, unitPriceTwd: amountTwd, subtotalTwd: amountTwd,
      createdAt: new Date(), createdBy: "member-e2e",
    }),
    db.collection("paymentRequests").doc(requestId).set({
      id: requestId, memberUid: "member-e2e", orderId, amountTwd, status: "open",
      method: "bankTransfer", createdAt: new Date(), createdBy: "system",
    }),
    db.collection("payments").doc(paymentId).set({
      id: paymentId, memberUid: "member-e2e", paymentRequestId: requestId,
      paymentGroupId: `${id}_group`, receivedAmountTwd: amountTwd,
      receivedAt: "2026-08-13T01:25:00.000Z", status: "pendingReview",
      memberPaymentAccount: { bankCode: "001", accountNumberLast5: accountLast5, payerName: "測試匯款人" },
      payerName: "測試匯款人", createdAt: new Date(), createdBy: "member-e2e",
    }),
  ]);
}

async function taishinWorkbook(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("交易明細");
  sheet.addRow(["台新銀行 - 交易明細"]);
  sheet.addRow(["交易日", "帳務日", "摘要", "金額", "餘額", "備註"]);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
