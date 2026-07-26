import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import {
  validateMemberProfileDraft,
  type MemberProfileDraft,
  type MemberProfileValidationResult,
} from "@/lib/member/profile";

export type MemberIdentity = {
  uid: string;
  email: string;
};

export type StoredMemberProfile = {
  uid: string;
  email: string;
  displayName: string;
  communityId: string;
  mobilePhone: string;
  birthday?: string;
  completedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export async function loadMemberProfile(db: Firestore, uid: string) {
  const snapshot = await getDoc(doc(db, "members", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as StoredMemberProfile;
}

export async function saveMemberProfile(
  db: Firestore,
  identity: MemberIdentity,
  draft: MemberProfileDraft,
): Promise<{ ok: true } | Extract<MemberProfileValidationResult, { ok: false }>> {
  const validation = validateMemberProfileDraft(draft);

  if (!validation.ok) {
    return validation;
  }

  const reference = doc(db, "members", identity.uid);
  const existing = await getDoc(reference);
  const profile = validation.value;

  if (existing.exists()) {
    await updateDoc(reference, {
      displayName: profile.displayName,
      communityId: profile.communityId,
      mobilePhone: profile.mobilePhone,
      birthday: profile.birthday ?? deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(reference, {
      uid: identity.uid,
      email: identity.email,
      displayName: profile.displayName,
      communityId: profile.communityId,
      mobilePhone: profile.mobilePhone,
      ...(profile.birthday ? { birthday: profile.birthday } : {}),
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { ok: true };
}
