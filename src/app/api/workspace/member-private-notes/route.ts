import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";

export async function PUT(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Partial<MemberPrivateNote>;
    const note = validateNote(body);
    const db = getAdminFirestore();
    const saved = await db.runTransaction(async (transaction) => {
      const memberRef = db.collection("members").doc(note.uid);
      const noteRef = db.collection("memberPrivateNotes").doc(note.uid);
      const [memberSnapshot, previousSnapshot] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(noteRef),
      ]);
      if (!memberSnapshot.exists) {
        throw new Error("member_not_found");
      }
      const previous = previousSnapshot.exists
        ? previousSnapshot.data() as MemberPrivateNote
        : { uid: note.uid, riskState: "normal" as const, internalNote: "" };
      transaction.set(noteRef, {
        ...note,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: "member.risk.updated",
        actorUid: claims.uid,
        targetType: "member",
        targetId: note.uid,
        reason: JSON.stringify({
          previous: {
            riskState: previous.riskState,
            internalNote: previous.internalNote ?? "",
          },
          next: {
            riskState: note.riskState,
            internalNote: note.internalNote ?? "",
          },
        }),
        createdAt: FieldValue.serverTimestamp(),
      });
      return note;
    });
    return NextResponse.json({ note: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "member_not_found"
          ? 404
          : message === "invalid_note"
            ? 400
            : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}

function validateNote(value: Partial<MemberPrivateNote>): MemberPrivateNote {
  const uid = typeof value.uid === "string" ? value.uid.trim() : "";
  const internalNote = typeof value.internalNote === "string" ? value.internalNote.trim() : "";
  if (
    !uid
    || !["normal", "watch", "blacklisted"].includes(value.riskState ?? "")
    || internalNote.length > 2000
  ) {
    throw new Error("invalid_note");
  }
  return {
    uid,
    riskState: value.riskState as MemberPrivateNote["riskState"],
    internalNote,
  };
}
