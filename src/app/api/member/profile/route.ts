import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  validateMemberProfileDraft,
  type MemberProfileDraft,
} from "@/lib/member/profile";

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as Partial<MemberProfileDraft>;
    const validation = validateMemberProfileDraft({
      displayName: body.displayName ?? "",
      communityId: body.communityId ?? "",
      mobilePhone: body.mobilePhone ?? "",
      birthday: body.birthday ?? "",
    });

    if (!validation.ok) {
      return NextResponse.json({ error: "validation_error", errors: validation.errors }, { status: 400 });
    }
    if (typeof claims.email !== "string" || !claims.email) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection("members").doc(claims.uid);
    const existing = await ref.get();
    const profile = validation.value;

    if (existing.exists) {
      await ref.update({
        displayName: profile.displayName,
        communityId: profile.communityId,
        mobilePhone: profile.mobilePhone,
        birthday: profile.birthday ?? FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await ref.set({
        uid: claims.uid,
        email: claims.email,
        displayName: profile.displayName,
        communityId: profile.communityId,
        mobilePhone: profile.mobilePhone,
        ...(profile.birthday ? { birthday: profile.birthday } : {}),
        completedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("Could not load the default credentials")) {
      return NextResponse.json({ error: "admin_credentials_not_configured" }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}
