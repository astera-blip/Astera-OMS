import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { sanitizeOwnerAuditLog } from "@/lib/audit/repository";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const snapshot = await getAdminFirestore().collection("auditLogs").get();
    return NextResponse.json({
      logs: snapshot.docs.flatMap((document) => {
        const log = sanitizeOwnerAuditLog(document.id, document.data());
        return log ? [log] : [];
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}
