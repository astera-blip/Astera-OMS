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

export const fallbackBrandContent: BrandContentBundle = {
  siteSettings: {
    id: "site-default",
    brandName: "Astera OMS",
    heroTitle: "代購品牌中心",
    heroDescription: "這裡集中放品牌入口、社群、客服與公告。",
    contactEmail: "astera.0920@gmail.com",
    supportHours: "平日晚上與週末為主",
    shippingNote: "小圈測試先以賣貨便為主。",
    updatedAt: "2026-07-26T00:00:00.000Z",
  },
  channels: [
    {
      key: "lineCommunity",
      title: "LINE 社群",
      url: "",
      description: "熟客討論、上新通知與小圈測試公告。",
      status: "planned",
    },
    {
      key: "lineOfficial",
      title: "LINE 官方帳號",
      url: "",
      description: "客服入口、付款提醒與重要通知。",
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
      answer: "依商品是現貨、預購或二補狀態而不同，商品頁會標示 sale type 與活動狀態。",
      order: 1,
      status: "published",
    },
    {
      id: "faq-2",
      question: "可以取消訂單嗎？",
      answer: "目前先走人工流程，之後會有 `/orders/[id]` 與取消申請頁。",
      order: 2,
      status: "published",
    },
    {
      id: "faq-3",
      question: "付款方式有哪些？",
      answer: "小圈測試先以銀行匯款為主，付款請求與人工確認會同步記錄。",
      order: 3,
      status: "published",
    },
  ],
  announcements: [
    {
      id: "ann-1",
      title: "小圈測試 MVP 已開放",
      body: "請先以公開商品與會員資料補齊流程進行驗收。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
    {
      id: "ann-2",
      title: "Email 仍為記錄模式",
      body: "目前 Email 仍以 notificationEvents 記錄，不會自動寄信。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
    {
      id: "ann-3",
      title: "公開商品來源",
      body: "若商品頁顯示找不到資料，代表尚未發布或尚未建立公開 projection。",
      publishedAt: "2026-07-26T00:00:00.000Z",
      status: "published",
    },
  ],
};

export function sortBrandFaqs(faqs: BrandFaq[]) {
  return [...faqs].sort((a, b) => a.order - b.order);
}
