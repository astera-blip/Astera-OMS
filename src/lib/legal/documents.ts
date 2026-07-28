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
  acceptedSupplementRule: boolean;
  acceptedAt: string;
};

export const legalDocumentVersions: LegalDocumentVersion[] = [
  {
    id: "terms-v2026-07-26",
    documentType: "terms",
    title: "Astera 下單條款",
    version: "2026-07-26",
    effectiveAt: "2026-07-26T00:00:00.000Z",
    body: "下單後請依付款請求完成銀行匯款並送出付款回報。訂單內容、商品規格、活動價格與二補提示以訂單成立當下保存的紀錄為準；預購、代搶與候補商品會依官方供貨、國際運送與整理進度通知。",
  },
  {
    id: "privacy-v2026-07-26",
    documentType: "privacy",
    title: "Astera 隱私權政策",
    version: "2026-07-26",
    effectiveAt: "2026-07-26T00:00:00.000Z",
    body: "會員資料僅用於帳號識別、訂單處理、付款確認、配送聯繫、退款處理與客服通知。Astera 會依服務需要保存必要紀錄，並限制內部作業資料的存取權限。",
  },
];

export function currentLegalVersionIds() {
  return legalDocumentVersions.map((document) => document.id);
}

export function createConsentRecord(input: {
  memberUid: string;
  orderId: string;
  acceptedAt: string;
  acceptedSupplementRule: boolean;
}): ConsentRecord {
  return {
    id: `consent_${input.orderId}`,
    memberUid: input.memberUid,
    orderId: input.orderId,
    legalVersionIds: currentLegalVersionIds(),
    acceptedSupplementRule: input.acceptedSupplementRule,
    acceptedAt: input.acceptedAt,
  };
}
