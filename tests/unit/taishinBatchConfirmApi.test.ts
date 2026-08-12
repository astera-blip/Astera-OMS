import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireFirebaseUser: vi.fn(), isOwnerClaim: vi.fn() }));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));
const parser = vi.hoisted(() => ({ parseTaishinWorkbook: vi.fn() }));
const matcher = vi.hoisted(() => ({ matchTaishinTransactions: vi.fn() }));
const confirmer = vi.hoisted(() => ({ confirmPendingPaymentGroup: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => auth);
vi.mock("@/lib/firebase/admin", () => firestore);
vi.mock("@/lib/reconciliation/taishin", () => ({ parseTaishinWorkbook: parser.parseTaishinWorkbook }));
vi.mock("@/lib/reconciliation/paymentMatching", () => ({ matchTaishinTransactions: matcher.matchTaishinTransactions }));
vi.mock("@/lib/payment/confirmPendingPayment", () => ({ confirmPendingPaymentGroup: confirmer.confirmPendingPaymentGroup }));

import { POST } from "@/app/api/workspace/reconciliation/taishin/confirm/route";

function request(selections: unknown) {
  const formData = new FormData();
  formData.set("file", new File([new Uint8Array([1])], "taishin.xlsx"));
  formData.set("reason", "台新 Excel 批次對帳認列");
  formData.set("selections", JSON.stringify(selections));
  return new Request("https://example.test/api/workspace/reconciliation/taishin/confirm", {
    method: "POST",
    body: formData,
  });
}

const safeSelection = {
  transactionFingerprint: "a".repeat(64),
  paymentGroupId: "group-1",
  paymentIds: ["payment-1"],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-1", role: "owner" });
  auth.isOwnerClaim.mockReturnValue(true);
  firestore.getAdminFirestore.mockReturnValue({
    collection: vi.fn(() => ({
      where: vi.fn(() => ({ get: vi.fn(async () => ({ docs: [] })) })),
    })),
  });
  parser.parseTaishinWorkbook.mockResolvedValue({ ok: true, sourceRowCount: 1, transactions: [] });
  matcher.matchTaishinTransactions.mockReturnValue({
    results: [{
      ...safeSelection,
      reconciliationItemId: "item-1",
      category: "unique_match",
      selectable: true,
      selectedByDefault: true,
      reason: "safe",
      transactionAt: "2026/08/13 09:30:00",
      accountingDate: "2026/08/13",
      method: "CD轉入",
      amountTwd: 520,
      accountLast5: "00001",
      paymentRequestIds: ["request-1"],
    }],
  });
  confirmer.confirmPendingPaymentGroup.mockResolvedValue({
    confirmations: [{ paymentId: "payment-1", paymentRequestStatus: "paid", orderStatus: "paid" }],
  });
});

describe("POST /api/workspace/reconciliation/taishin/confirm", () => {
  it("denies non-Owner users", async () => {
    auth.isOwnerClaim.mockReturnValue(false);
    const response = await POST(request([safeSelection]));
    expect(response.status).toBe(403);
  });

  it("revalidates safe selections and confirms them", async () => {
    const response = await POST(request([safeSelection]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { requested: 1, succeeded: 1, failed: 0 },
      results: [{ reconciliationItemId: "item-1", status: "confirmed" }],
    });
    expect(confirmer.confirmPendingPaymentGroup).toHaveBeenCalledWith(expect.objectContaining({
      paymentIds: ["payment-1"],
      actorUid: "owner-1",
      reconciliation: expect.objectContaining({ transactionFingerprint: "a".repeat(64) }),
    }));
  });

  it("rejects a forged selection without calling confirmation", async () => {
    const response = await POST(request([{ ...safeSelection, paymentIds: ["forged-payment"] }]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { requested: 1, succeeded: 0, failed: 1 },
      results: [{ status: "failed", error: "selection_not_valid" }],
    });
    expect(confirmer.confirmPendingPaymentGroup).not.toHaveBeenCalled();
  });
});
