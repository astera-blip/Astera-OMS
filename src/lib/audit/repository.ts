import { collection, getDocs, type Firestore } from "firebase/firestore";
import type { LocalAuditLog } from "@/lib/payment/manualBankTransfer";

export async function listAuditLogs(db: Firestore): Promise<LocalAuditLog[]> {
  const snapshot = await getDocs(collection(db, "auditLogs"));

  return snapshot.docs.map((document) => document.data() as LocalAuditLog);
}
