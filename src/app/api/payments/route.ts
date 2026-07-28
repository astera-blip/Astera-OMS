import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as {
      paymentRequestId?: string;
      receivedAt?: string;
      receivedAmountTwd?: number;
      transferAccountLast5?: string;
      payerName?: string;
      memberNote?: string;
    };
    const paymentRequestId = body.paymentRequestId?.trim() ?? "";
    const receivedAt = body.receivedAt?.trim() ?? "";
    const receivedAmountTwd = body.receivedAmountTwd;
    const transferAccountLast5 = body.transferAccountLast5?.trim() ?? "";
    const payerName = body.payerName?.trim() ?? "";
    const memberNote = body.memberNote?.trim() ?? "";

    if (
      !paymentRequestId
      || !receivedAt
      || typeof receivedAmountTwd !== "number"
      || !Number.isInteger(receivedAmountTwd)
      || receivedAmountTwd <= 0
      || !/^[0-9]{5}$/.test(transferAccountLast5)
      || !payerName
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const payment = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("paymentRequests").doc(paymentRequestId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) {
        throw new Error("not_found");
      }

      const paymentRequest = requestSnapshot.data() as {
        memberUid?: string;
        status?: string;
      };
      if (paymentRequest.memberUid !== claims.uid) {
        throw new Error("forbidden");
      }
      if (paymentRequest.status === "paid" || paymentRequest.status === "cancelled") {
        throw new Error("invalid_payment_request");
      }

      const paymentRef = db.collection("payments").doc();
      const paymentRecord = {
        id: paymentRef.id,
        memberUid: claims.uid,
        paymentRequestId,
        receivedAmountTwd,
        receivedAt,
        transferAccountLast5,
        payerName,
        ...(memberNote ? { memberNote } : {}),
        status: "pendingReview",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: claims.uid,
      };

      transaction.set(paymentRef, paymentRecord);

      return {
        ...paymentRecord,
        createdAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "forbidden"
          ? 403
          : message === "not_found"
            ? 404
            : message === "invalid_payment_request"
              ? 400
              : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
