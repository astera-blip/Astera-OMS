import { collection, getDocs, serverTimestamp, setDoc, doc, type Firestore } from "firebase/firestore";

export type LegalDocumentRecord = {
  id: string;
  title: string;
  version: string;
  status: "draft" | "published" | "archived";
  content: string;
};

export type ConsentRecordInput = {
  memberUid: string;
  orderId?: string;
  legalDocumentVersion: string;
  consentedAt: string;
  ipAddress?: string;
  requestMeta?: string;
  contentSnapshot: string;
};

export async function loadLegalDocumentVersions(db: Firestore) {
  const snapshot = await getDocs(collection(db, "legalDocumentVersions"));
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as Omit<LegalDocumentRecord, "id">),
  }));
}

export async function saveConsentRecord(db: Firestore, consentId: string, input: ConsentRecordInput) {
  await setDoc(doc(db, "consentRecords", consentId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ok: true as const, consentId };
}
