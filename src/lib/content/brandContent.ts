export type BrandChannelKey = "lineCommunity" | "lineOfficial" | "instagram";

export type BrandChannel = {
  key: BrandChannelKey;
  title: string;
  url: string;
  description: string;
  status: "active" | "planned" | "disabled";
};

export type BrandFaq = {
  id: string;
  question: string;
  answer: string;
  order: number;
  status: "published" | "draft";
};

export type BrandAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  status: "published" | "draft";
};

export type SiteSettings = {
  id: string;
  brandName: string;
  heroTitle: string;
  heroDescription: string;
  contactEmail: string;
  supportHours: string;
  shippingNote: string;
  updatedAt: string;
};

export type BrandContentBundle = {
  siteSettings: SiteSettings | null;
  channels: BrandChannel[];
  faqs: BrandFaq[];
  announcements: BrandAnnouncement[];
};

export const emptyBrandContent: BrandContentBundle = {
  siteSettings: null,
  channels: [],
  faqs: [],
  announcements: [],
};

export const fallbackBrandContent: BrandContentBundle = {
  siteSettings: {
    id: "site-default",
    brandName: "Astera",
    heroTitle: "Astera 泰國 GL / 藝人周邊代購",
    heroDescription: "集中整理開團公告、付款提醒、二補說明、取消規則與客服聯絡方式。",
    contactEmail: "astera.0920@gmail.com",
    supportHours: "平日晚上與週末回覆為主",
    shippingNote: "現貨依付款確認後安排寄出；預購與代搶商品依官方到貨、國際運送與整理進度通知。",
    updatedAt: "2026-07-26T00:00:00.000Z",
  },
  channels: [
    {
      key: "lineCommunity",
      title: "LINE 社群",
      url: "",
      description: "開團提醒、到貨公告與重要通知。",
      status: "planned",
    },
    {
      key: "lineOfficial",
      title: "LINE 官方帳號",
      url: "",
      description: "客服聯絡、付款回報提醒與訂單問題處理。",
      status: "planned",
    },
    {
      key: "instagram",
      title: "Instagram",
      url: "",
      description: "商品預告、開團視覺與品牌日常。",
      status: "planned",
    },
  ],
  faqs: [
    {
      id: "faq-1",
      question: "下單後多久會出貨？",
      answer: "現貨會在付款確認後依排程寄出；預購、代搶與候補商品需等官方出貨、國際運送與整理完成後通知寄送。",
      order: 1,
      status: "published",
    },
    {
      id: "faq-2",
      question: "可以取消訂單嗎？",
      answer: "未付款項目可申請取消；已付款項目需送出取消申請，經客服確認可退款後，會以人工銀行退款處理。",
      order: 2,
      status: "published",
    },
    {
      id: "faq-3",
      question: "付款方式有哪些？",
      answer: "目前採銀行匯款。下單後請依付款請求金額匯款，並回報匯款日期、金額、帳號末五碼與匯款人。",
      order: 3,
      status: "published",
    },
    {
      id: "faq-4",
      question: "什麼是二補？",
      answer: "二補是商品到貨後依實際國際運費、匯率、官方配貨或包材等差額追加收取的費用。需要二補的商品會在商品頁與 checkout 顯示提醒。",
      order: 4,
      status: "published",
    },
  ],
  announcements: [
    {
      id: "ann-1",
      title: "Astera 商品頁陸續整理中",
      body: "已發布商品會顯示於商品列表；若看不到特定商品，代表尚未開放或活動已結束。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
    {
      id: "ann-2",
      title: "付款回報請填寫完整資訊",
      body: "完成銀行匯款後，請到付款頁回報日期、金額、帳號末五碼與匯款人，以便客服對帳。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
    {
      id: "ann-3",
      title: "預購與代搶商品可能產生二補",
      body: "若商品頁標示需要二補，請於 checkout 前確認已了解相關規則；實際金額會依到貨後成本差額通知。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
  ],
};

export function sortBrandFaqs(faqs: BrandFaq[]) {
  return [...faqs].sort((a, b) => a.order - b.order);
}

export function getChannelTitle(key: BrandChannelKey) {
  return {
    lineCommunity: "LINE 社群",
    lineOfficial: "LINE 官方帳號",
    instagram: "Instagram",
  }[key];
}
