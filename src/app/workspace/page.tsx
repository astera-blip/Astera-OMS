"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

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

const helperCards = [
  {
    title: "目前沒有待處理任務",
    detail: "搶購任務與成本填寫功能會在 Owner 或 Partner 指派後顯示於此。",
  },
];

export default function WorkspaceHomePage() {
  const { role } = useAuth();
  const router = useRouter();
  const isHelper = role === "helper";

  useEffect(() => {
    if (role === "owner") {
      router.replace("/workspace/products");
    }
  }, [role, router]);

  if (role === "owner") {
    return (
      <section className="rounded-xl border border-astera-border bg-astera-surface p-6">
        <p role="status" aria-live="polite" className="text-sm text-astera-secondary">
          正在開啟商品工作區…
        </p>
      </section>
    );
  }

  const cards = partnerCards;
  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-service">
          {role === "partner" ? "Partner Operations" : isHelper ? "Helper Operations" : "Owner Operations"}
        </p>
        <h2 className="mt-2 font-serif text-3xl">{isHelper ? "小幫手工作區" : "工作區總覽"}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-astera-secondary">
          {role === "partner"
            ? "建立商品與活動草稿，送交 Owner 審核後才會套用正式資料。"
            : isHelper
              ? "在此查看已指派的搶購與成本填寫任務；尚未指派時不會顯示其他營運資料。"
            : "從商品、活動到付款與會員服務，集中處理每日營運工作。"}
        </p>
      </div>

      {isHelper ? (
        <div className="grid gap-4 md:grid-cols-2">
          {helperCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-astera-border bg-astera-surface p-5">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-astera-secondary">{card.detail}</p>
            </article>
          ))}
        </div>
      ) : (
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
      )}
    </section>
  );
}
