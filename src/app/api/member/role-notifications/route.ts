import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { isAssignableRole, isRoleKey } from "@/lib/member/rolePolicy";

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      return (toDate as () => Date)().toISOString();
    }
  }
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const snapshot = await getAdminFirestore()
      .collection("roleChangeNotifications")
      .where("memberUid", "==", claims.uid)
      .where("acknowledgedAt", "==", null)
      .orderBy("changedAt", "desc")
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    if (!document) {
      return NextResponse.json({ notification: null });
    }
    const data = document.data() as Record<string, unknown>;
    if (!isRoleKey(data.previousRole) || !isAssignableRole(data.nextRole)) {
      return NextResponse.json({ notification: null });
    }
    return NextResponse.json({
      notification: {
        id: document.id,
        previousRole: data.previousRole,
        nextRole: data.nextRole,
        changedAt: timestampToIso(data.changedAt),
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 160) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const db = getAdminFirestore();
    await db.runTransaction(async (transaction) => {
      const reference = db.collection("roleChangeNotifications").doc(id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.memberUid !== claims.uid) {
        throw new Error("notification_not_found");
      }
      if (snapshot.data()?.acknowledgedAt == null) {
        transaction.update(reference, { acknowledgedAt: FieldValue.serverTimestamp() });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "notification_not_found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return authErrorResponse(error);
  }
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "missing_token" || message === "invalid_token" ? 401 : 500;
  return NextResponse.json(
    { error: status === 500 ? "internal_error" : message },
    { status },
  );
}
