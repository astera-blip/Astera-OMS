import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
}));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));
const parser = vi.hoisted(() => ({ parseTaishinWorkbook: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
  isOwnerClaim: auth.isOwnerClaim,
}));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: firestore.getAdminFirestore }));
vi.mock("@/lib/reconciliation/taishin", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/reconciliation/taishin")>(),
  parseTaishinWorkbook: parser.parseTaishinWorkbook,
}));

import { POST } from "@/app/api/workspace/reconciliation/taishin/route";

function uploadRequest() {
  const formData = new FormData();
  formData.set("file", new File(
    [new Uint8Array([1, 2, 3])],
    "taishin.xlsx",
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ));
  return new Request("https://example.test/api/workspace/reconciliation/taishin", {
    method: "POST",
    body: formData,
  });
}

function createDb(options: { claimed?: boolean } = {}) {
  const pendingPayment = {
    id: "payment-1",
    memberUid: "member-1",
    paymentRequestId: "request-1",
    paymentGroupId: "group-1",
    receivedAmountTwd: 520,
    receivedAt: "2026-08-13T01:25:00.000Z",
    status: "pendingReview",
    memberPaymentAccount: {
      bankCode: "001",
      accountNumberLast5: "00001",
      payerName: "測試匯款人",
    },
    payerName: "測試匯款人",
    createdAt: "2026-08-13T01:26:00.000Z",
    createdBy: "member-1",
  };
  return {
    collection: vi.fn((name: string) => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: name === "payments"
            ? [{ id: "payment-1", data: () => pendingPayment }]
            : options.claimed
              ? [{ id: "reconciliation-a", data: () => ({
                action: "payment.reconciliation.claimed",
                reconciliation: { transactionFingerprint: "a".repeat(64) },
              }) }]
              : [],
        })),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-1", role: "owner" });
  auth.isOwnerClaim.mockReturnValue(true);
  parser.parseTaishinWorkbook.mockResolvedValue({
    ok: true,
    sourceRowCount: 1,
    transactions: [{
      transactionAt: "2026/08/13 09:30:00",
      accountingDate: "2026/08/13",
      method: "CD轉入",
      amountTwd: 520,
      accountLast5: "00001",
      transactionFingerprint: "a".repeat(64),
    }],
  });
  firestore.getAdminFirestore.mockReturnValue(createDb());
});

describe("POST /api/workspace/reconciliation/taishin", () => {
  it("denies non-Owner users", async () => {
    auth.isOwnerClaim.mockReturnValue(false);
    const response = await POST(uploadRequest());
    expect(response.status).toBe(403);
    expect(firestore.getAdminFirestore).not.toHaveBeenCalled();
  });

  it("compares the workbook with authoritative pending payment groups", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.summary).toMatchObject({
      sourceRowCount: 1,
      pendingPaymentGroupCount: 1,
      uniqueMatchCount: 1,
      selectableCount: 1,
    });
    expect(payload.results).toEqual([
      expect.objectContaining({
        category: "unique_match",
        paymentGroupId: "group-1",
        selectable: true,
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("餘額");
    expect(JSON.stringify(payload)).not.toContain("remark");
  });

  it("marks a previously claimed bank transaction as duplicate", async () => {
    firestore.getAdminFirestore.mockReturnValue(createDb({ claimed: true }));
    const response = await POST(uploadRequest());
    const payload = await response.json();
    expect(payload.summary).toMatchObject({ duplicateCount: 1, selectableCount: 0 });
    expect(payload.results[0]).toMatchObject({ category: "duplicate", selectable: false });
  });
});
