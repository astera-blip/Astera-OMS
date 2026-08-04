import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { CancellationRequestRecord } from "@/lib/order/cancellation";
import { sanitizeCancellationRequest } from "@/lib/order/repository";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const snapshot = await getAdminFirestore().collection("cancellationRequests").get();
    const requests = snapshot.docs.map((document) =>
      sanitizeCancellationRequest({
        id: document.id,
        ...(document.data() as Omit<CancellationRequestRecord, "id">),
      }));

    return NextResponse.json({ requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}
