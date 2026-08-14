"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

const ownerCards = [
  {
    href: "/workspace/products",
    title: "商品與活動 Products",
    detail: "管理商品、Variant 與販售 Campaign。",
  },
  {
    href: "/workspace/members",
    title: "會員 Members",
    detail: "會員資料、風險標記與內部備註。",
  },
  {
    href: "/workspace/orders",
    title: "訂單 Orders",
    detail: "訂單容器、快照與狀態流轉。",
  },
  {
    href: "/workspace/payments",
    title: "付款 Payments",
    detail: "收款帳戶設定、匯款確認、分配與對帳紀錄。",
  },
  {
    href: "/workspace/payments#payment-accounts",
    title: "收款帳戶 Payment Accounts",
    detail: "設定會員付款回報可選擇的 Astera 收款銀行帳戶。",
  },
];

const partnerCards = [
  {
    href: "/workspace/products",
    title: "商品草稿 Products",
    detail: "依正式商品建立 Product、Variant 與 Campaign 變更草稿。",
  },
  {
    href: "/workspace/catalog-reviews",
    title: "商品草稿 Catalog Reviews",
    detail: "查看送審、駁回原因與修訂狀態。",
  },
];

export default function WorkspaceHomePage() {
  const { role } = useAuth();
  const cards = role === "partner" ? partnerCards : ownerCards;
  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-service">
          {role === "partner" ? "Partner Operations" : "Owner Operations"}
        </p>
        <h2 className="mt-2 font-serif text-3xl">工作區總覽</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-astera-secondary">
          {role === "partner"
            ? "建立商品與活動草稿，送交 Owner 審核後才會套用正式資料。"
            : "從商品、活動到付款與會員服務，集中處理每日營運工作。"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-astera-border bg-astera-surface p-5 transition-colors hover:border-astera-brand hover:bg-astera-brand-soft"
          >
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-astera-secondary">{card.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
