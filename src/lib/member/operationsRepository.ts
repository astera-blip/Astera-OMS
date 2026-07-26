import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { StoredMemberProfile } from "./repository";

export type MemberPrivateNote = {
  uid: string;
  riskState: "normal" | "watch" | "blacklisted";
  internalNote?: string;
};

export async function listMembers(db: Firestore): Promise<StoredMemberProfile[]> {
  const snapshot = await getDocs(collection(db, "members"));

  return snapshot.docs.map((document) => document.data() as StoredMemberProfile);
}

export async function listMemberPrivateNotes(
  db: Firestore,
): Promise<MemberPrivateNote[]> {
  const snapshot = await getDocs(collection(db, "memberPrivateNotes"));

  return snapshot.docs.map((document) => document.data() as MemberPrivateNote);
}

export async function saveMemberPrivateNote(
  db: Firestore,
  note: MemberPrivateNote,
) {
  await setDoc(doc(db, "memberPrivateNotes", note.uid), {
    ...note,
    updatedAt: serverTimestamp(),
  });
}
