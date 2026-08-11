import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireFirebaseUser: vi.fn() }));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => ({ requireFirebaseUser: auth.requireFirebaseUser }));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: firestore.getAdminFirestore }));

import { GET } from "@/app/api/payments/route";

function createDb() {
  const docs = [
    {
      id: "payment-old",
      data: () => ({
        memberUid: "member-a",
        paymentRequestId: "pr-old",
        paymentGroupId: "group-old",
        receivedAmountTwd: 500,
        receivedAt: "2026-08-10",
        status: "confirmed",
        receivingPaymentAccount: { bankName: "Astera Bank", accountNumberLast5: "99999" },
        memberPaymentAccount: {
          bankCode: "012",
          accountNumberLast5: "56789",
          payerName: "王小明",
          accountFingerprint: "secret-fingerprint",
          fingerprintKeyVersion: 7,
        },
        memberNote: "會員備註",
        adminNote: "內部判斷",
        createdAt: { toDate: () => new Date("2026-08-10T01:00:00.000Z") },
        createdBy: "member-a",
      }),
    },
    {
      id: "payment-new",
      data: () => ({
        memberUid: "member-a",
        paymentRequestId: "pr-new",
        paymentGroupId: "group-new",
        receivedAmountTwd: 520,
        receivedAt: "2026-08-11",
        status: "pendingReview",
        receivingPaymentAccount: { bankName: "Astera Bank", accountNumberLast5: "99999" },
        memberPaymentAccount: { bankCode: "013", accountNumberLast5: "12345", payerName: "陳小美" },
        createdAt: "2026-08-11T02:00:00.000Z",
      }),
    },
  ];
  const get = vi.fn(async () => ({ docs }));
  const where = vi.fn(() => ({ get }));
  const collection = vi.fn(() => ({ where }));
  return { collection, where, get };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/payments", () => {
  it("requires authentication", async () => {
    auth.requireFirebaseUser.mockRejectedValue(new Error("missing_token"));

    const response = await GET(new Request("https://example.test/api/payments"));

    expect(response.status).toBe(401);
  });

  it("returns only current-member sanitized records newest first", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    const db = createDb();
    firestore.getAdminFirestore.mockReturnValue(db);

    const response = await GET(new Request("https://example.test/api/payments"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(db.where).toHaveBeenCalledWith("memberUid", "==", "member-a");
    expect(payload.payments.map((payment: { id: string }) => payment.id)).toEqual([
      "payment-new",
      "payment-old",
    ]);
    expect(payload.payments[0]).toEqual({
      id: "payment-new",
      paymentRequestId: "pr-new",
      paymentGroupId: "group-new",
      receivedAmountTwd: 520,
      receivedAt: "2026-08-11",
      status: "pendingReview",
      receivingAccountDisplay: "Astera Bank・末五碼 99999",
      memberAccountDisplay: "銀行代碼 013・***12345・陳小美",
      createdAt: "2026-08-11T02:00:00.000Z",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("secret-fingerprint");
    expect(serialized).not.toContain("fingerprintKeyVersion");
    expect(serialized).not.toContain("accountFingerprint");
    expect(serialized).not.toContain("adminNote");
    expect(serialized).not.toContain("createdBy");
    expect(serialized).not.toContain("memberUid");
  });
});
