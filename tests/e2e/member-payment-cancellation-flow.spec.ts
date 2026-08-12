import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const password = "Password123!";
const memberAccountFingerprint = createHmac(
  "sha256",
  "e2e-fingerprint-key-version-7",
)
  .update("astera:bank-account:v1|012|00123412345")
  .digest("base64");

test("member checkout splits by campaign and payment/cancellation APIs preserve ledger state", async ({
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Server API flow runs once.");

  const db = getAdminDb();
  const runKey = `${testInfo.project.name}_${Date.now()}`
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const memberToken = await signIn(request, "member-e2e@example.test");
  const ownerToken = await signIn(request, "owner-e2e@example.test");

  const ownerAccountsResponse = await request.get("/api/workspace/payment-accounts", {
    headers: authorized(ownerToken),
  });
  expect(ownerAccountsResponse.ok()).toBe(true);
  expect(await ownerAccountsResponse.json()).toMatchObject({
    accounts: [expect.objectContaining({ id: "e2e-account", status: "active" })],
  });

  const memberAccountsResponse = await request.get("/api/payment-accounts", {
    headers: authorized(memberToken),
  });
  expect(memberAccountsResponse.ok()).toBe(true);
  const memberAccounts = await memberAccountsResponse.json() as {
    accounts: Array<Record<string, unknown>>;
  };
  expect(memberAccounts.accounts).toEqual([
    expect.objectContaining({ id: "e2e-account", accountNumberLast5: "67890" }),
  ]);
  expect(memberAccounts.accounts[0]).not.toHaveProperty("status");

  const memberCannotManageAccounts = await request.post("/api/workspace/payment-accounts", {
    headers: authorized(memberToken),
    data: {
      bankName: "不應建立",
      accountName: "Member",
      accountNumberLast5: "00000",
    },
  });
  expect(memberCannotManageAccounts.status()).toBe(403);

  const checkoutRequest = {
    idempotencyKey: `e2e_split_${runKey}`,
      cart: [
        {
          productId: "prod_e2e_flow",
          variantId: "var_e2e_flow_default",
          saleCampaignId: "camp_e2e_flow_preorder",
          quantity: 1,
        },
        {
          productId: "prod_e2e_flow",
          variantId: "var_e2e_flow_default",
          saleCampaignId: "camp_e2e_flow_rush",
          quantity: 2,
        },
      ],
      recipientName: "測試會員",
      recipientPhone: "0912345678",
      shippingMethod: "seven_eleven",
      acceptedLegalTerms: true,
      acceptedSupplementRule: true,
      legalVersionIds: ["terms-v2026-07-26", "privacy-v2026-07-26"],
  };
  const checkoutResponse = await request.post("/api/checkout", {
    headers: authorized(memberToken),
    data: checkoutRequest,
  });
  expect(checkoutResponse.ok()).toBe(true);
  const checkout = await checkoutResponse.json() as {
    orders: Array<{ orderId: string; orderNumber: string; paymentRequestId: string; totalTwd: number }>;
  };

  expect(checkout.orders).toHaveLength(2);
  expect(checkout.orders.map((order) => order.orderNumber)).toEqual([
    expect.stringMatching(/^AST-\d{8}-\d{4}$/),
    expect.stringMatching(/^AST-\d{8}-\d{4}$/),
  ]);
  expect(new Set(checkout.orders.map((order) => order.paymentRequestId)).size).toBe(2);
  expect(checkout.orders.map((order) => order.totalTwd).sort((a, b) => a - b)).toEqual([640, 1500]);

  const repeatedCheckoutResponse = await request.post("/api/checkout", {
    headers: authorized(memberToken),
    data: checkoutRequest,
  });
  expect(repeatedCheckoutResponse.ok()).toBe(true);
  const repeatedCheckout = await repeatedCheckoutResponse.json() as {
    alreadyExists: boolean;
    orders: typeof checkout.orders;
  };
  expect(repeatedCheckout.alreadyExists).toBe(true);
  expect(repeatedCheckout.orders).toEqual(checkout.orders);

  const paidOrder = checkout.orders.find((order) => order.totalTwd === 640);
  const unpaidOrder = checkout.orders.find((order) => order.totalTwd === 1500);
  expect(paidOrder).toBeTruthy();
  expect(unpaidOrder).toBeTruthy();

  const paymentResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: paidOrder!.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: 700,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_overpayment_20260727",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "client-controlled-fingerprint",
      fingerprintKeyVersion: 99,
      payerName: "前端偽造姓名",
      memberNote: "E2E overpayment",
    },
  });
  expect(paymentResponse.ok()).toBe(true);
  const paymentPayload = await paymentResponse.json() as {
    payment: {
      id: string;
      paymentGroupId?: string;
      status: string;
      receivingPaymentAccount?: { id: string; accountNumberLast5: string };
      memberPaymentAccount?: {
        bankCode: string;
        accountNumberLast5: string;
        accountFingerprint: string;
        fingerprintAlgorithm: string;
        fingerprintKeyVersion: number;
        payerName: string;
      };
      manualFingerprintReviewRequired?: boolean;
    };
  };
  expect(paymentPayload.payment.status).toBe("pendingReview");
  expect(paymentPayload.payment.receivingPaymentAccount).toMatchObject({ id: "e2e-account", accountNumberLast5: "67890" });
  expect(paymentPayload.payment.memberPaymentAccount).toEqual({
    bankCode: "012",
    accountNumberLast5: "12345",
    accountFingerprint: memberAccountFingerprint,
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: 7,
    payerName: "測試會員甲",
  });
  expect(paymentPayload.payment.manualFingerprintReviewRequired).toBe(false);

  const replayPaymentResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: paidOrder!.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: 700,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_overpayment_20260727",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "client-controlled-fingerprint",
      fingerprintKeyVersion: 99,
      payerName: "前端偽造姓名",
      memberNote: "E2E overpayment",
    },
  });
  expect(replayPaymentResponse.ok()).toBe(true);
  await expect(replayPaymentResponse.json()).resolves.toMatchObject({
    alreadyExists: true,
    paymentGroupId: paymentPayload.payment.paymentGroupId,
    payment: { id: paymentPayload.payment.id },
  });

  const memberPaymentsResponse = await request.get("/api/payments", {
    headers: authorized(memberToken),
  });
  expect(memberPaymentsResponse.ok()).toBe(true);
  const memberPaymentsPayload = await memberPaymentsResponse.json() as {
    payments: Array<Record<string, unknown>>;
  };
  expect(memberPaymentsPayload.payments).toContainEqual(expect.objectContaining({
    id: paymentPayload.payment.id,
    status: "pendingReview",
    memberAccountDisplay: "銀行代碼 012・***12345・測試會員甲",
  }));
  expect(JSON.stringify(memberPaymentsPayload)).not.toContain(memberAccountFingerprint);

  const blockedDuplicateResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: paidOrder!.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: 700,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_rejected_duplicate_20260727",
      memberNote: "E2E duplicate report must be blocked",
    },
  });
  expect(blockedDuplicateResponse.status()).toBe(409);
  await expect(blockedDuplicateResponse.json()).resolves.toEqual({
    error: "payment_report_pending_review",
  });

  const rejectionCandidateData = {
    paymentRequestId: unpaidOrder!.paymentRequestId,
    receivedAt: "2026-07-27",
    receivedAmountTwd: unpaidOrder!.totalTwd,
    receivingPaymentAccountId: "e2e-account",
    memberPaymentAccountId: "member-e2e-account",
    memberNote: "E2E report to reject",
  };
  const concurrentResponses = await Promise.all([
    request.post("/api/payments", {
      headers: authorized(memberToken),
      data: {
        ...rejectionCandidateData,
        idempotencyKey: "e2e_payment_rejection_candidate_a_20260727",
      },
    }),
    request.post("/api/payments", {
      headers: authorized(memberToken),
      data: {
        ...rejectionCandidateData,
        idempotencyKey: "e2e_payment_rejection_candidate_b_20260727",
      },
    }),
  ]);
  expect(concurrentResponses.map((response) => response.status()).sort()).toEqual([200, 409]);
  const successfulConcurrentIndex = concurrentResponses.findIndex((response) => response.ok());
  const rejectedCandidateResponse = concurrentResponses[successfulConcurrentIndex];
  const concurrentBlockedResponse = concurrentResponses.find((response) => response.status() === 409);
  if (!rejectedCandidateResponse) {
    throw new Error("Expected one concurrent payment report to succeed.");
  }
  expect(concurrentBlockedResponse).toBeTruthy();
  await expect(concurrentBlockedResponse!.json()).resolves.toEqual({
    error: "payment_report_pending_review",
  });
  const rejectedCandidate = await rejectedCandidateResponse.json() as { payment: { id: string } };
  const rejectResponse = await request.post(
    `/api/workspace/payments/${rejectedCandidate.payment.id}/reject`,
    {
      headers: authorized(ownerToken),
      data: { reason: "E2E 重複付款回報" },
    },
  );
  expect(rejectResponse.ok()).toBe(true);
  await expect(rejectResponse.json()).resolves.toMatchObject({
    paymentId: rejectedCandidate.payment.id,
    paymentStatus: "rejected",
    alreadyRejected: false,
  });
  expect((await db.collection("payments").doc(rejectedCandidate.payment.id).get()).data()?.status)
    .toBe("rejected");
  expect((await db.collection("auditLogs").doc(`audit_reject_${rejectedCandidate.payment.id}`).get()).data())
    .toMatchObject({ action: "payment.rejected", targetId: rejectedCandidate.payment.id });

  const rejectedReplayResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      ...rejectionCandidateData,
      idempotencyKey: successfulConcurrentIndex === 0
        ? "e2e_payment_rejection_candidate_a_20260727"
        : "e2e_payment_rejection_candidate_b_20260727",
    },
  });
  expect(rejectedReplayResponse.ok()).toBe(true);
  await expect(rejectedReplayResponse.json()).resolves.toMatchObject({
    alreadyExists: true,
    payment: { id: rejectedCandidate.payment.id, status: "rejected" },
  });

  const confirmResponse = await request.post(`/api/workspace/payments/${paymentPayload.payment.id}/confirm`, {
    headers: authorized(ownerToken),
    data: { reason: "E2E 對帳確認" },
  });
  expect(confirmResponse.ok()).toBe(true);
  expect(await confirmResponse.json()).toMatchObject({
    paymentId: paymentPayload.payment.id,
    paymentRequestStatus: "paid",
    orderStatus: "paid",
  });

  const confirmedReplayResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: paidOrder!.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: 700,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_overpayment_20260727",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "client-controlled-fingerprint",
      fingerprintKeyVersion: 99,
      payerName: "前端偽造姓名",
      memberNote: "E2E overpayment",
    },
  });
  expect(confirmedReplayResponse.ok()).toBe(true);
  await expect(confirmedReplayResponse.json()).resolves.toMatchObject({
    alreadyExists: true,
    payment: { id: paymentPayload.payment.id, status: "confirmed" },
  });

  const paidRequestAfterConfirm = await db.collection("paymentRequests").doc(paidOrder!.paymentRequestId).get();
  expect(paidRequestAfterConfirm.data()?.unallocatedAmountTwd).toBe(60);

  const reverseResponse = await request.post(`/api/workspace/payments/${paymentPayload.payment.id}/reverse`, {
    headers: authorized(ownerToken),
    data: { reason: "E2E 撤銷確認" },
  });
  expect(reverseResponse.ok()).toBe(true);
  expect(await reverseResponse.json()).toMatchObject({
    paymentId: paymentPayload.payment.id,
    paymentStatus: "reversed",
    paymentRequestStatus: "open",
    orderStatus: "awaitingPayment",
  });
  const paymentAfterReverse = await db.collection("payments").doc(paymentPayload.payment.id).get();
  expect(paymentAfterReverse.data()?.memberPaymentAccount).toEqual({
    bankCode: "012",
    accountNumberLast5: "12345",
    accountFingerprint: memberAccountFingerprint,
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: 7,
    payerName: "測試會員甲",
  });

  const reversedReplayResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: paidOrder!.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: 700,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_overpayment_20260727",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "client-controlled-fingerprint",
      fingerprintKeyVersion: 99,
      payerName: "前端偽造姓名",
      memberNote: "E2E overpayment",
    },
  });
  expect(reversedReplayResponse.ok()).toBe(true);
  await expect(reversedReplayResponse.json()).resolves.toMatchObject({
    alreadyExists: true,
    payment: { id: paymentPayload.payment.id, status: "reversed" },
  });

  const unpaidItems = await listOrderItems(unpaidOrder!.orderId);
  const directCancelResponse = await request.post("/api/cancellations", {
    headers: authorized(memberToken),
    data: {
      orderId: unpaidOrder!.orderId,
      orderItemIds: unpaidItems.map((item) => item.id),
      reason: "E2E 未付款取消",
      idempotencyKey: `e2e_unpaid_cancel_${runKey}`,
    },
  });
  expect(directCancelResponse.ok()).toBe(true);
  const directCancel = await directCancelResponse.json() as {
    requestId: string | null;
    directlyCancelledItemIds: string[];
    pendingReviewItemIds: string[];
  };
  expect(directCancel.requestId).toBeNull();
  expect(directCancel.directlyCancelledItemIds).toEqual(unpaidItems.map((item) => item.id));
  expect(directCancel.pendingReviewItemIds).toEqual([]);

  const paidCheckoutResponse = await request.post("/api/checkout", {
    headers: authorized(memberToken),
    data: {
      idempotencyKey: `e2e_paid_cancel_${runKey}`,
      cart: [
        {
          productId: "prod_e2e_flow",
          variantId: "var_e2e_flow_default",
          saleCampaignId: "camp_e2e_flow_preorder",
          quantity: 1,
        },
      ],
      recipientName: "測試會員",
      recipientPhone: "0912345678",
      shippingMethod: "seven_eleven",
      acceptedLegalTerms: true,
      acceptedSupplementRule: true,
      legalVersionIds: ["terms-v2026-07-26", "privacy-v2026-07-26"],
    },
  });
  expect(paidCheckoutResponse.ok()).toBe(true);
  const paidCheckout = await paidCheckoutResponse.json() as {
    orders: Array<{ orderId: string; paymentRequestId: string; totalTwd: number }>;
  };
  const orderForPaidCancellation = paidCheckout.orders[0];

  const exactPaymentResponse = await request.post("/api/payments", {
    headers: authorized(memberToken),
    data: {
      paymentRequestId: orderForPaidCancellation.paymentRequestId,
      receivedAt: "2026-07-27",
      receivedAmountTwd: orderForPaidCancellation.totalTwd,
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      idempotencyKey: "e2e_payment_exact_cancellation_20260727",
      payerName: "另一個前端偽造姓名",
    },
  });
  expect(exactPaymentResponse.ok()).toBe(true);
  const exactPayment = await exactPaymentResponse.json() as { payment: { id: string } };
  const exactConfirmResponse = await request.post(`/api/workspace/payments/${exactPayment.payment.id}/confirm`, {
    headers: authorized(ownerToken),
    data: { reason: "E2E 付款後取消前確認" },
  });
  expect(exactConfirmResponse.ok()).toBe(true);

  const paidItems = await listOrderItems(orderForPaidCancellation.orderId);
  const mismatchAuditsBefore = await db.collection("auditLogs")
    .where("action", "==", "refund.account.mismatch")
    .get();
  const mismatchStatuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const mismatchResponse = await request.post("/api/cancellations", {
      headers: {
        ...authorized(memberToken),
        "x-forwarded-for": "203.0.113.27",
      },
      data: {
        orderId: orderForPaidCancellation.orderId,
        orderItemIds: paidItems.map((item) => item.id),
        reason: "E2E 錯誤退款帳戶",
        idempotencyKey: `e2e_refund_mismatch_${runKey}`,
        targetPaymentId: exactPayment.payment.id,
        refundBankCode: "012",
        refundAccountNumberFull: "00999912345",
      },
    });
    mismatchStatuses.push(mismatchResponse.status());
    expect(JSON.stringify(await mismatchResponse.json()))
      .not.toContain("00999912345");
  }
  expect(mismatchStatuses).toEqual([400, 400, 400, 400, 400, 429]);

  const [mismatchAuditsAfter, allocationsAfterMismatch] = await Promise.all([
    db.collection("auditLogs")
      .where("action", "==", "refund.account.mismatch")
      .get(),
    db.collection("paymentAllocations")
      .where("paymentId", "==", exactPayment.payment.id)
      .get(),
  ]);
  expect(mismatchAuditsAfter.size - mismatchAuditsBefore.size).toBe(5);
  expect(allocationsAfterMismatch.docs
    .filter((snapshot) => snapshot.data().kind === "adjustment")).toHaveLength(0);
  expect(JSON.stringify(mismatchAuditsAfter.docs.map((snapshot) => snapshot.data())))
    .not.toMatch(/00999912345|accountNumber|fingerprint|ciphertext/i);

  const paidCancelResponse = await request.post("/api/cancellations", {
    headers: {
      ...authorized(memberToken),
      "x-forwarded-for": "203.0.113.28",
    },
    data: {
      orderId: orderForPaidCancellation.orderId,
      orderItemIds: paidItems.map((item) => item.id),
      reason: "E2E 已付款取消",
      idempotencyKey: `e2e_paid_cancel_request_${runKey}`,
      targetPaymentId: exactPayment.payment.id,
      refundBankCode: "012",
      refundAccountNumberFull: "00123412345",
    },
  });
  expect(paidCancelResponse.ok()).toBe(true);
  const paidCancel = await paidCancelResponse.json() as {
    requestId: string;
    directlyCancelledItemIds: string[];
    pendingReviewItemIds: string[];
  };
  expect(paidCancel.directlyCancelledItemIds).toEqual([]);
  expect(paidCancel.pendingReviewItemIds).toEqual(paidItems.map((item) => item.id));
  expect(JSON.stringify(paidCancel)).not.toContain("00123412345");
  const paidCancelRequestId = paidCancel.requestId;

  const pendingCancellation = await db.collection("cancellationRequests")
    .doc(paidCancelRequestId)
    .get();
  const refundAccountExpiresAt = String(
    pendingCancellation.data()?.refundAccountExpiresAt ?? "",
  );
  expect(pendingCancellation.data()).toMatchObject({
    refundBankCode: "012",
    refundAccountLast5: "12345",
    refundEncryptionKeyVersion: 4,
  });
  expect(pendingCancellation.data()).not.toHaveProperty("refundAccountNumberFull");
  expect(Date.parse(refundAccountExpiresAt) - Date.now()).toBeGreaterThan(0);
  expect(Date.parse(refundAccountExpiresAt) - Date.now())
    .toBeLessThanOrEqual(14 * 24 * 60 * 60 * 1000);

  const revealResponse = await request.get(
    `/api/workspace/cancellations/${paidCancelRequestId}/refund-account`,
    { headers: authorized(ownerToken) },
  );
  expect(revealResponse.ok()).toBe(true);
  await expect(revealResponse.json()).resolves.toEqual({
    refundAccount: {
      bankCode: "012",
      accountNumberFull: "00123412345",
      expiresAt: refundAccountExpiresAt,
    },
  });
  const revealAudits = await db.collection("auditLogs")
    .where("targetId", "==", paidCancelRequestId)
    .get();
  expect(revealAudits.docs.map((snapshot) => snapshot.data().action))
    .toContain("refund.account.revealed");

  const reviewResponse = await request.post(`/api/workspace/cancellations/${paidCancelRequestId}/review`, {
    headers: authorized(ownerToken),
    data: {
      status: "approved",
      reviewNote: "E2E 人工退款完成",
      refundAmountTwd: orderForPaidCancellation.totalTwd,
      refundCompletedAt: "2026-07-27",
      refundReference: "BANK-E2E-001",
    },
  });
  expect(reviewResponse.ok()).toBe(true);
  expect(await reviewResponse.json()).toMatchObject({
    status: "approved",
    orderStatus: "refunded",
    amountTwd: 0,
  });
  const [reviewedCancellation, refundedOrder, refundAdjustment, refundAudit] = await Promise.all([
    db.collection("cancellationRequests").doc(paidCancelRequestId).get(),
    db.collection("orders").doc(orderForPaidCancellation.orderId).get(),
    db.collection("paymentAllocations").doc(`adj_refund_${paidCancelRequestId}`).get(),
    db.collection("auditLogs").doc(`audit_refund_${paidCancelRequestId}`).get(),
  ]);
  expect(reviewedCancellation.data()).not.toHaveProperty("refundAccountCiphertext");
  expect(reviewedCancellation.data()).not.toHaveProperty("refundEncryptionKeyVersion");
  expect(reviewedCancellation.data()).not.toHaveProperty("refundAccountExpiresAt");
  expect(refundedOrder.data()?.status).toBe("refunded");
  expect(refundAdjustment.data()).toMatchObject({
    paymentId: exactPayment.payment.id,
    kind: "adjustment",
    amountTwd: -orderForPaidCancellation.totalTwd,
  });
  expect(refundAudit.exists).toBe(true);
});

test("member payment UI prevents rapid duplicate submits and keeps status after reload", async ({
  page,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Idempotency UI flow runs once.");

  const db = getAdminDb();
  const paymentRequestId = `pr_ui_idempotency_${Date.now()}`;
  const orderId = `order_ui_idempotency_${Date.now()}`;
  await db.collection("paymentRequests").doc(paymentRequestId).set({
    id: paymentRequestId,
    memberUid: "member-e2e",
    orderId,
    amountTwd: 520,
    allocatedAmountTwd: 0,
    status: "open",
    method: "bankTransfer",
    createdAt: new Date(),
    createdBy: "system",
  });

  let postCount = 0;
  await page.route("**/api/payments", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    await route.continue();
  });

  await page.goto("/e2e-auth?next=/payments");
  await page.getByLabel("Email").fill("member-e2e@example.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "匯款回報" })).toBeVisible();
  const requestCheckboxes = page.locator('input[name="paymentRequestIds"]');
  for (let index = 0; index < await requestCheckboxes.count(); index += 1) {
    const checkbox = requestCheckboxes.nth(index);
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }
  const targetRequest = page.getByRole("checkbox", { name: new RegExp(orderId) });
  await targetRequest.check();
  await page.getByLabel("匯款日期").fill("2026-08-11");

  const submit = page.getByRole("button", { name: "送出付款回報" });
  await submit.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByText(/已送出 1 筆付款回報/)).toBeVisible();
  expect(postCount).toBe(1);
  await expect(page.getByRole("heading", { name: "我的付款回報" })).toBeVisible();
  await expect(page.getByText("已回報／待確認", { exact: true }).first()).toBeVisible();
  await expect(targetRequest).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("heading", { name: "我的付款回報" })).toBeVisible();
  await expect(page.getByText("已回報／待確認", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: new RegExp(orderId) })).toBeDisabled();
});

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({ projectId: "demo-astera-oms" });
  }

  return getFirestore();
}

async function signIn(request: APIRequestContext, email: string) {
  const response = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      data: {
        email,
        password,
        returnSecureToken: true,
      },
    },
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { idToken?: string };
  expect(payload.idToken).toBeTruthy();

  return payload.idToken!;
}

function authorized(token: string) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function listOrderItems(orderId: string) {
  const snapshot = await getAdminDb()
    .collection("orderItems")
    .where("orderId", "==", orderId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
