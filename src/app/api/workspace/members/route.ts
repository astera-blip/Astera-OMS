import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { groupDuplicatePhones } from "@/lib/member/duplicatePhones";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";
import type { StoredMemberProfile } from "@/lib/member/repository";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const [membersSnapshot, notesSnapshot] = await Promise.all([
      db.collection("members").get(),
      db.collection("memberPrivateNotes").get(),
    ]);
    const members = membersSnapshot.docs.map((document) => {
      const data = document.data() as StoredMemberProfile;
      return {
        uid: data.uid ?? document.id,
        email: data.email ?? "",
        displayName: data.displayName ?? "",
        communityId: data.communityId ?? "",
        mobilePhone: data.mobilePhone ?? "",
        ...(data.birthday ? { birthday: data.birthday } : {}),
      };
    });
    const privateNotes = notesSnapshot.docs.map((document) => {
      const data = document.data() as MemberPrivateNote;
      return {
        uid: data.uid ?? document.id,
        riskState: data.riskState ?? "normal",
        internalNote: data.internalNote ?? "",
      } satisfies MemberPrivateNote;
    });
    return NextResponse.json({
      members,
      privateNotes,
      duplicatePhoneGroups: groupDuplicatePhones(members),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
