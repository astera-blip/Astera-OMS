import Link from "next/link";

const cards = [
  {
    href: "/workspace/products",
    title: "Products",
    detail: "商品、Variant、Sale Campaign 的本機 CRUD 工作區。",
  },
  {
    href: "/workspace/members",
    title: "Members",
    detail: "會員資料、風險標記與內部備註。",
  },
  {
    href: "/workspace/orders",
    title: "Orders",
    detail: "訂單容器、快照與狀態流轉。",
  },
  {
    href: "/workspace/payments",
    title: "Payments",
    detail: "匯款確認、分配與對帳紀錄。",
  },
];

export default function WorkspaceHomePage() {
  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Operations
        </p>
        <h2 className="mt-2 text-2xl font-semibold">工作區總覽</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          先把商品後台做完整，之後再把會員、訂單與付款一起串成同一套營運流程。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
