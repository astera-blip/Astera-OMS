import { collection, getDocs, type Firestore } from "firebase/firestore";

export type MemberAdminRecord = {
  uid: string;
  email: string;
  displayName: string;
  communityId: string;
  mobilePhone: string;
  birthday?: string;
  completedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function loadMembers(db: Firestore) {
  const snapshot = await getDocs(collection(db, "members"));

  return snapshot.docs.map((member) => ({
    uid: member.id,
    ...(member.data() as Omit<MemberAdminRecord, "uid">),
  }));
}

export function findDuplicatePhones(members: MemberAdminRecord[]) {
  const groups = new Map<string, MemberAdminRecord[]>();

  for (const member of members) {
    const current = groups.get(member.mobilePhone) ?? [];
    current.push(member);
    groups.set(member.mobilePhone, current);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([mobilePhone, items]) => ({ mobilePhone, items }));
}
