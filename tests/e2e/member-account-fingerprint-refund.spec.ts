import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
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
import {
  appendRefundVerificationFailure,
  buildRefundVerificationScopes,
  readRefundVerificationCooldown,
} from "@/lib/order/refundVerificationAttempts";

const useEmulatedAuth = process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const exactAccountNumber = "00123456789";
const collisionAccountNumber = "00999956789";
const fakeKeys = new Map([
  [3, "e2e-fingerprint-key-version-3"],
  [7, "e2e-fingerprint-key-version-7"],
]);

test("seeds labeled owner, helper, member A, and member B account identities", async () => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  const db = getAdminDb();
  const snapshots = await Promise.all([
    db.collection("memberPaymentAccounts").doc("member-a-exact-e2e").get(),
    db.collection("memberPaymentAccounts").doc("member-b-exact-e2e").get(),
    db.collection("memberPaymentAccounts").doc("member-b-collision-e2e").get(),
  ]);

  expect(snapshots.every((snapshot) => snapshot.exists)).toBe(true);
  const [memberA, memberBExact, memberBCollision] = snapshots.map(
    (snapshot) => snapshot.data() as Record<string, unknown>,
  );
  expect(memberA.accountFingerprint).toBe(memberBExact.accountFingerprint);
  expect(memberA.accountFingerprint).not.toBe(memberBCollision.accountFingerprint);
  expect(memberA).toMatchObject({
    bankCode: "012",
    accountNumberLast5: "56789",
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: 7,
  });
  for (const account of [memberA, memberBExact, memberBCollision]) {
    expect(account).not.toHaveProperty("accountNumberFull");
  }
});

test("member binding output and duplicate notifications never expose the full account", async () => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  const db = getAdminDb();
  const [accountSnapshot, exactEvent, collisionEvent] = await Promise.all([
    db.collection("memberPaymentAccounts").doc("member-a-exact-e2e").get(),
    db.collection("notificationEvents").doc("member-account-exact-duplicate-e2e").get(),
    db.collection("notificationEvents").doc("member-account-last5-collision-e2e").get(),
  ]);
  const storedAccount = {
    id: accountSnapshot.id,
    ...accountSnapshot.data(),
  } as AccountIdentity & {
    id: string;
    memberUid: string;
    status: "active";
    verificationStatus: "verified";
  };
  const publicAccount = buildMemberPaymentAccountSnapshot(storedAccount);

  expect(publicAccount).toEqual({
    id: "member-a-exact-e2e",
    bankCode: "012",
    accountNumberMasked: "***56789",
    accountNumberLast5: "56789",
    status: "active",
    verificationStatus: "verified",
  });
  expect(JSON.stringify({
    account: publicAccount,
    notifications: [exactEvent.data(), collisionEvent.data()],
  })).not.toMatch(/00123456789|00999956789|accountNumberFull|accountFingerprint|canonical/i);
  expect(exactEvent.data()).toMatchObject({
    type: "memberPaymentAccount.exactDuplicate",
    status: "pendingReview",
  });
  expect(collisionEvent.data()).toMatchObject({
    type: "memberPaymentAccount.last5Collision",
    status: "pendingReview",
  });
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

test("refund mismatches are audited and become rate limited without creating an adjustment", async () => {
  test.skip(!useEmulatedAuth, "Requires Auth/Firestore emulator seed.");

  const db = getAdminDb();
  const now = new Date("2026-08-04T00:00:00.000Z");
  const scopes = buildRefundVerificationScopes({
    requestId: `cancel-mismatch-${Date.now()}`,
    memberUid: "member-e2e",
    requestIp: "203.0.113.7",
  }, "e2e-refund-rate-limit-secret-32-characters");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const limitedBeforeWrite = await db.runTransaction((transaction) =>
      appendRefundVerificationFailure({
        transaction,
        db,
        scopes,
        verification: "mismatch",
        now: new Date(now.getTime() + attempt),
      }));
    expect(limitedBeforeWrite).toBe(false);
  }

  await expect(readRefundVerificationCooldown({
    db,
    scopes,
    now: new Date(now.getTime() + 10),
  })).resolves.toMatchObject({
    limited: true,
    scope: "request",
  });
  const [audits, adjustments] = await Promise.all([
    db.collection("auditLogs")
      .where("requestScopeHash", "==", scopes.requestScopeHash)
      .get(),
    db.collection("paymentAllocations")
      .where("paymentId", "==", "cancel-mismatch-e2e")
      .get(),
  ]);
  expect(audits.size).toBe(5);
  expect(adjustments.empty).toBe(true);
  expect(JSON.stringify(audits.docs.map((document) => document.data())))
    .not.toMatch(/00123456789|00999956789|accountNumber|fingerprint|ciphertext/i);
});

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({ projectId: "demo-astera-oms" });
  }

  return getFirestore();
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
