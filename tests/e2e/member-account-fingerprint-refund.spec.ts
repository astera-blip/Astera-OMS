import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  deriveAccountIdentity,
  verifyAccountIdentity,
  type AccountIdentity,
  type CloudKmsMacClient,
} from "@/lib/payment/accountIdentity";
import { buildMemberPaymentAccountSnapshot } from "@/lib/payment/memberBankAccounts";
import { buildMemberPaymentAccountIdentitySnapshot } from "@/lib/payment/manualBankTransfer";
import { verifyRefundAccountForPayment } from "@/lib/order/cancellation";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const password = "Password123!";
const exactAccountNumber = "00123456789";
const collisionAccountNumber = "00999956789";
const fakeKeys = new Map([
  [3, "e2e-fingerprint-key-version-3"],
  [7, "e2e-fingerprint-key-version-7"],
]);

test("member API registers cross-version exact duplicates and last-five collisions without exposing full accounts", async ({
  request,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Server API flow runs once.");

  const db = getAdminDb();
  const [memberToken, ownerToken] = await Promise.all([
    signIn(request, "member-duplicate-e2e@example.test"),
    signIn(request, "owner-e2e@example.test"),
  ]);
  const exactResponse = await request.post("/api/member/payment-accounts", {
    headers: authorized(memberToken),
    data: {
      bankCode: "012",
      accountNumberFull: exactAccountNumber,
      payerName: "重複帳戶測試甲",
    },
  });
  expect(exactResponse.status()).toBe(201);
  const exactPayload = await exactResponse.json() as {
    account: Record<string, unknown>;
    warning?: string;
  };
  expect(exactPayload).toMatchObject({
    account: {
      bankCode: "012",
      accountNumberMasked: "***56789",
      accountNumberLast5: "56789",
      payerName: "重複帳戶測試甲",
      verificationStatus: "verified",
    },
    warning: "member_payment_account_duplicate_review_pending",
  });
  expect(JSON.stringify(exactPayload)).not.toMatch(
    /00123456789|accountNumberFull|accountFingerprint|canonical/i,
  );

  const collisionResponse = await request.post("/api/member/payment-accounts", {
    headers: authorized(memberToken),
    data: {
      bankCode: "012",
      accountNumberFull: collisionAccountNumber,
      payerName: "重複帳戶測試乙",
    },
  });
  expect(collisionResponse.status()).toBe(201);
  const collisionPayload = await collisionResponse.json() as {
    account: Record<string, unknown>;
    warning?: string;
  };
  expect(collisionPayload.warning).toBe("member_payment_account_duplicate_review_pending");
  expect(JSON.stringify(collisionPayload)).not.toMatch(
    /00999956789|accountNumberFull|accountFingerprint|canonical/i,
  );

  const [storedAccounts, ownerNotificationsResponse] = await Promise.all([
    db.collection("memberPaymentAccounts")
      .where("memberUid", "==", "member-duplicate-e2e")
      .get(),
    request.get("/api/workspace/notifications", {
      headers: authorized(ownerToken),
    }),
  ]);
  expect(storedAccounts.size).toBe(2);
  const storedRecords = storedAccounts.docs.map((snapshot) => snapshot.data());
  expect(storedRecords.map((record) => record.fingerprintKeyVersion))
    .toEqual([7, 7]);
  expect(storedRecords.every((record) =>
    !("accountNumberFull" in record)
    && record.accountNumberLast5 === "56789"
    && typeof record.payerName === "string"
    && typeof record.accountFingerprint === "string")).toBe(true);

  expect(ownerNotificationsResponse.ok()).toBe(true);
  const ownerNotifications = await ownerNotificationsResponse.json() as {
    notifications: Array<{ type: string; status: string; accountIds: string[] }>;
  };
  expect(ownerNotifications.notifications).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: "memberPaymentAccount.exactDuplicate",
      status: "pendingReview",
    }),
    expect.objectContaining({
      type: "memberPaymentAccount.last5Collision",
      status: "pendingReview",
    }),
  ]));
  expect(JSON.stringify(ownerNotifications)).not.toMatch(
    /00123456789|00999956789|accountNumberFull|accountFingerprint|canonical/i,
  );

  const memberA = await db.collection("memberPaymentAccounts")
    .doc("member-a-exact-e2e")
    .get();
  expect(memberA.data()?.fingerprintKeyVersion).toBe(3);
  expect(storedRecords.map((record) => record.accountFingerprint))
    .not.toContain(memberA.data()?.accountFingerprint);
  const publicAccount = buildMemberPaymentAccountSnapshot({
    id: storedAccounts.docs[0].id,
    ...storedAccounts.docs[0].data(),
  } as AccountIdentity & {
    id: string;
    memberUid: string;
    status: "active";
    verificationStatus: "verified";
  });
  expect(publicAccount.accountNumberMasked).toBe("***56789");
});

test("legacy member account requires one-time payer-name completion", async ({
  request,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Server API flow runs once.");

  const memberToken = await signIn(request, "member-e2e@example.test");
  const beforeResponse = await request.get("/api/member/payment-accounts", {
    headers: authorized(memberToken),
  });
  expect(beforeResponse.ok()).toBe(true);
  const beforePayload = await beforeResponse.json() as {
    accounts: Array<Record<string, unknown>>;
  };
  expect(beforePayload.accounts).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: "member-e2e-legacy-name",
      accountNumberMasked: "***33333",
      needsPayerName: true,
    }),
    expect.objectContaining({
      id: "member-e2e-account",
      payerName: "測試會員甲",
      needsPayerName: false,
    }),
  ]));

  const completionResponse = await request.post(
    "/api/member/payment-accounts/member-e2e-legacy-name/payer-name",
    {
      headers: authorized(memberToken),
      data: { payerName: "舊帳戶測試會員" },
    },
  );
  expect(completionResponse.ok()).toBe(true);
  expect(await completionResponse.json()).toMatchObject({
    account: {
      id: "member-e2e-legacy-name",
      payerName: "舊帳戶測試會員",
      needsPayerName: false,
    },
  });

  const repeatedResponse = await request.post(
    "/api/member/payment-accounts/member-e2e-legacy-name/payer-name",
    {
      headers: authorized(memberToken),
      data: { payerName: "不得覆寫" },
    },
  );
  expect(repeatedResponse.status()).toBe(409);
});

test("new identities use the latest key while refunds verify the payment snapshot version", async () => {
  const kms = new FakeKmsMac(7);
  const latestIdentity = await deriveAccountIdentity({
    bankCode: "012",
    accountNumber: exactAccountNumber,
  }, kms);
  const historicalIdentity = await identityForVersion(
    kms,
    "012",
    exactAccountNumber,
    3,
  );
  const historicalCollision = await identityForVersion(
    kms,
    "012",
    collisionAccountNumber,
    3,
  );

  expect(latestIdentity.fingerprintKeyVersion).toBe(7);
  expect(latestIdentity.accountFingerprint).not.toBe(historicalIdentity.accountFingerprint);
  expect(historicalIdentity.accountFingerprint).not.toBe(historicalCollision.accountFingerprint);
  expect(buildMemberPaymentAccountIdentitySnapshot(historicalIdentity)).toEqual(
    historicalIdentity,
  );

  kms.calls.length = 0;
  await expect(verifyRefundAccountForPayment({
    refundBankCode: "012",
    refundAccountNumberFull: exactAccountNumber,
    payment: {
      memberPaymentAccount: buildMemberPaymentAccountIdentitySnapshot(historicalIdentity),
    },
    macClient: kms,
  })).resolves.toBe("match");
  expect(kms.calls.at(-1)?.keyVersion).toBe(3);

  await expect(verifyRefundAccountForPayment({
    refundBankCode: "012",
    refundAccountNumberFull: collisionAccountNumber,
    payment: {
      memberPaymentAccount: buildMemberPaymentAccountIdentitySnapshot(historicalIdentity),
    },
    macClient: kms,
  })).resolves.toBe("mismatch");
  await expect(verifyAccountIdentity(
    { bankCode: "012", accountNumber: exactAccountNumber },
    latestIdentity,
    kms,
  )).resolves.toBe(true);
});

test("helper and member tokens are denied by high-risk APIs while Owner reads succeed", async ({
  request,
}, testInfo) => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");
  test.skip(testInfo.project.name !== "chromium-desktop", "Server API flow runs once.");

  const [helperToken, memberToken, ownerToken] = await Promise.all([
    signIn(request, "helper-e2e@example.test"),
    signIn(request, "member-e2e@example.test"),
    signIn(request, "owner-e2e@example.test"),
  ]);
  for (const token of [helperToken, memberToken]) {
    const responses = await Promise.all([
      request.get("/api/workspace/notifications", {
        headers: authorized(token),
      }),
      request.get("/api/workspace/audit-logs", {
        headers: authorized(token),
      }),
      request.put("/api/workspace/member-private-notes", {
        headers: authorized(token),
        data: {
          uid: "member-e2e",
          riskState: "watch",
          internalNote: "must not be written",
        },
      }),
      request.post("/api/workspace/payments/forbidden-e2e/confirm", {
        headers: authorized(token),
        data: { reason: "must not confirm" },
      }),
      request.post("/api/workspace/payments/forbidden-e2e/reverse", {
        headers: authorized(token),
        data: { reason: "must not reverse" },
      }),
      request.post("/api/workspace/cancellations/forbidden-e2e/review", {
        headers: authorized(token),
        data: {
          status: "approved",
          reviewNote: "must not refund",
          refundAmountTwd: 1,
          refundCompletedAt: "2026-08-04",
          refundReference: "forbidden",
        },
      }),
      request.get("/api/workspace/cancellations/forbidden-e2e/refund-account", {
        headers: authorized(token),
      }),
    ]);
    expect(responses.map((response) => response.status()))
      .toEqual([403, 403, 403, 403, 403, 403, 403]);
  }

  const [ownerNotifications, ownerAuditLogs] = await Promise.all([
    request.get("/api/workspace/notifications", {
      headers: authorized(ownerToken),
    }),
    request.get("/api/workspace/audit-logs", {
      headers: authorized(ownerToken),
    }),
  ]);
  expect(ownerNotifications.ok()).toBe(true);
  expect(ownerAuditLogs.ok()).toBe(true);
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

class FakeKmsMac implements CloudKmsMacClient {
  readonly calls: Array<{ canonical: string; keyVersion: number }> = [];

  constructor(private readonly latestKeyVersion: number) {}

  async signCanonicalAccount(canonical: string, keyVersion = this.latestKeyVersion) {
    const key = fakeKeys.get(keyVersion);
    if (!key) {
      throw new Error("unknown_test_key_version");
    }
    this.calls.push({ canonical, keyVersion });
    return {
      mac: createHmac("sha256", key).update(canonical).digest("base64"),
      keyVersion,
    };
  }
}

async function identityForVersion(
  kms: FakeKmsMac,
  bankCode: string,
  accountNumber: string,
  keyVersion: number,
): Promise<AccountIdentity> {
  const signed = await kms.signCanonicalAccount(
    `astera:bank-account:v1|${bankCode}|${accountNumber}`,
    keyVersion,
  );
  return {
    bankCode,
    accountNumberLast5: accountNumber.slice(-5),
    accountFingerprint: signed.mac,
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: signed.keyVersion,
  };
}
