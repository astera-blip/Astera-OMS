import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";

type MemberPrivateNoteRequestBody = {
  note?: MemberPrivateNote;
};

export async function PUT(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);

    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "owner_required" }, { status: 403 });
    }

    const body = (await request.json()) as MemberPrivateNoteRequestBody;

    if (!isMemberPrivateNote(body.note)) {
      return NextResponse.json({ error: "invalid_note" }, { status: 400 });
    }

    await getAdminFirestore().collection("memberPrivateNotes").doc(body.note.uid).set({
      ...body.note,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

function isMemberPrivateNote(value: unknown): value is MemberPrivateNote {
  const note = value as Partial<MemberPrivateNote>;

  return !!note
    && typeof note.uid === "string"
    && note.uid.length > 0
    && (note.riskState === "normal" || note.riskState === "watch" || note.riskState === "blacklisted")
    && (note.internalNote === undefined || typeof note.internalNote === "string");
}
