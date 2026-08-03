import { expect, test, type APIRequestContext } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const password = "Password123!";

test("member checkout splits by campaign and payment/cancellation APIs preserve ledger state", async ({
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

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
      transferAccountLast5: "12345",
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "client-controlled-fingerprint",
      fingerprintKeyVersion: 99,
      payerName: "測試會員",
      memberNote: "E2E overpayment",
    },
  });
  expect(paymentResponse.ok()).toBe(true);
  const paymentPayload = await paymentResponse.json() as {
    payment: {
      id: string;
      status: string;
      receivingPaymentAccount?: { id: string; accountNumberLast5: string };
      memberPaymentAccount?: {
        bankCode: string;
        accountNumberLast5: string;
        accountFingerprint: string;
        fingerprintKeyVersion: number;
      };
      manualFingerprintReviewRequired?: boolean;
    };
  };
  expect(paymentPayload.payment.status).toBe("pendingReview");
  expect(paymentPayload.payment.receivingPaymentAccount).toMatchObject({ id: "e2e-account", accountNumberLast5: "67890" });
  expect(paymentPayload.payment.memberPaymentAccount).toEqual({
    bankCode: "012",
    accountNumberLast5: "12345",
    accountFingerprint: "e2e-member-account-fingerprint",
    fingerprintKeyVersion: 7,
  });
  expect(paymentPayload.payment.manualFingerprintReviewRequired).toBe(false);

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
    accountFingerprint: "e2e-member-account-fingerprint",
    fingerprintKeyVersion: 7,
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
      transferAccountLast5: "12345",
      receivingPaymentAccountId: "e2e-account",
      memberPaymentAccountId: "member-e2e-account",
      payerName: "測試會員",
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
  const paidCancelResponse = await request.post("/api/cancellations", {
    headers: authorized(memberToken),
    data: {
      orderId: orderForPaidCancellation.orderId,
      orderItemIds: paidItems.map((item) => item.id),
      reason: "E2E 已付款取消",
      idempotencyKey: `e2e_paid_cancel_request_${runKey}`,
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

  const reviewResponse = await request.post(`/api/workspace/cancellations/${paidCancel.requestId}/review`, {
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
    orderStatus: "cancelled",
    amountTwd: 0,
  });
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
