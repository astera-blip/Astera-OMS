import { describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: firestore.getDocs,
  query: vi.fn((source: unknown) => source),
  where: vi.fn(),
}));

import { listAllPayments, listMemberPaymentRequests } from "@/lib/payment/repository";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

describe("listMemberPaymentRequests", () => {
  it("normalizes Firestore timestamps before payment UI renders them", async () => {
    firestore.getDocs.mockResolvedValueOnce({
      docs: [{
        data: () => ({
          id: "payment-request-1",
          memberUid: "member-a",
          orderId: "order-1",
          amountTwd: 520,
          status: "open",
          method: "bankTransfer",
          createdAt: {
            toDate: () => new Date("2026-08-02T04:00:00.000Z"),
          },
          updatedAt: { seconds: 1785643500, nanoseconds: 0 },
          createdBy: "system",
        }),
      }],
    });

    const requests = await listMemberPaymentRequests({} as never, "member-a");

    expect(requests[0]?.createdAt).toBe("2026-08-02T04:00:00.000Z");
    expect(requests[0]?.updatedAt).toBe("2026-08-02T04:05:00.000Z");
  });
});

describe("listAllPayments", () => {
  it("requires manual fingerprint review for historical payments without upgrading last-five matches", async () => {
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            id: "payment-historical",
            memberUid: "member-a",
            paymentRequestId: "request-a",
            receivedAmountTwd: 520,
            receivedAt: "2026-07-01",
            transferAccountLast5: "56789",
            status: "confirmed",
            createdAt: "2026-07-01T00:00:00.000Z",
            createdBy: "member-a",
          }),
        },
        {
          data: () => ({
            id: "payment-current",
            memberUid: "member-a",
            paymentRequestId: "request-b",
            receivedAmountTwd: 630,
            receivedAt: "2026-08-03",
            transferAccountLast5: "56789",
            memberPaymentAccount: {
              bankCode: "012",
              accountNumberLast5: "56789",
              accountFingerprint: validFingerprint,
              fingerprintAlgorithm: "HMAC-SHA-256",
              fingerprintKeyVersion: 7,
            },
            status: "pendingReview",
            createdAt: "2026-08-03T00:00:00.000Z",
            createdBy: "member-a",
          }),
        },
      ],
    });

    const payments = await listAllPayments({} as never);

    expect(payments[0]).toMatchObject({
      id: "payment-historical",
      transferAccountLast5: "56789",
      manualFingerprintReviewRequired: true,
    });
    expect(payments[1]).toMatchObject({
      id: "payment-current",
      manualFingerprintReviewRequired: false,
      memberPaymentAccount: {
        accountFingerprint: validFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
      },
    });
  });
});
