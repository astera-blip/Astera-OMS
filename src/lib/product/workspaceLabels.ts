export const publishStateLabels = {
  draft: "Draft（草稿）",
  published: "Published（已刊登）",
  archived: "Archived（已封存）",
} as const;

export const saleTypeLabels = {
  inStock: "In Stock（現貨）",
  preorder: "Preorder（預購）",
  rushPurchase: "Rush Purchase（代搶）",
  waitlist: "Waitlist（候補）",
} as const;

export const campaignStatusLabels = {
  upcoming: "Upcoming（即將開始）",
  open: "Open（開放中）",
  closed: "Closed（已結束）",
  archived: "Archived（已封存）",
} as const;

export const classificationStatusLabels = {
  active: "Active（啟用）",
  archived: "Archived（已封存）",
} as const;

export const currencyOptions = [
  { value: "THB", label: "THB（泰銖）" },
  { value: "TWD", label: "TWD（新台幣）" },
  { value: "JPY", label: "JPY（日圓）" },
  { value: "KRW", label: "KRW（韓元）" },
  { value: "USD", label: "USD（美元）" },
] as const;
