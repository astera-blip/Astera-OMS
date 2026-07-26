export type LegalDocumentVersion = {
  id: string;
  documentType: "terms" | "privacy";
  title: string;
  version: string;
  body: string;
  effectiveAt: string;
};

export type ConsentRecord = {
  id: string;
  memberUid: string;
  orderId: string;
  legalVersionIds: string[];
  acceptedAt: string;
};

export const legalDocumentVersions: LegalDocumentVersion[] = [
  {
    id: "terms-v2026-07-26",
    documentType: "terms",
    title: "小圈測試下單條款",
    version: "2026-07-26",
    effectiveAt: "2026-07-26T00:00:00.000Z",
    body: "本系統目前為小圈測試版本。下單後需依付款請求完成銀行匯款，訂單內容以成立當下保存的商品快照為準。",
  },
  {
    id: "privacy-v2026-07-26",
    documentType: "privacy",
    title: "小圈測試隱私權政策",
    version: "2026-07-26",
    effectiveAt: "2026-07-26T00:00:00.000Z",
    body: "會員資料僅用於訂單處理、付款確認與營運聯繫。內部備註、風險紀錄與付款內部資料不提供前台讀取。",
  },
];

export function currentLegalVersionIds() {
  return legalDocumentVersions.map((document) => document.id);
}

export function createConsentRecord(input: {
  memberUid: string;
  orderId: string;
  acceptedAt: string;
}): ConsentRecord {
  return {
    id: `consent_${input.orderId}`,
    memberUid: input.memberUid,
    orderId: input.orderId,
    legalVersionIds: currentLegalVersionIds(),
    acceptedAt: input.acceptedAt,
  };
}
