"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type MemberAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  dueAt?: string;
};

export function MemberHomeActions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<MemberAction[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const loadActions = useCallback(async () => {
    if (!user) {
      setActions([]);
      setState("ready");
      return;
    }
    setState("loading");
    try {
      const [{ db }, { listMemberOrders }, { listMemberPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
        import("@/lib/payment/repository"),
      ]);
      const [orders, paymentRequests] = await Promise.all([
        listMemberOrders(db, user.uid),
        listMemberPaymentRequests(db, user.uid),
      ]);
      const orderLabels = new Map(orders.map(({ order }) => [
        order.id,
        order.orderNumber ?? order.id,
      ]));
      const next = paymentRequests
        .filter((request) => request.status === "open" || request.status === "partiallyPaid")
        .sort((left, right) => dateValue(left.dueAt) - dateValue(right.dueAt))
        .slice(0, 3)
        .map((request) => ({
          id: request.id,
          title: request.status === "partiallyPaid" ? "尚有款項待處理" : "待付款／待回報",
          description: `${orderLabels.get(request.orderId) ?? "訂單"} · NT$ ${request.amountTwd.toLocaleString()}`,
          href: `/payments?paymentRequestId=${encodeURIComponent(request.id)}`,
          ...(request.dueAt ? { dueAt: request.dueAt } : {}),
        }));
      setActions(next);
      setState("ready");
    } catch {
      setActions([]);
      setState("error");
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadActions());
  }, [loadActions]);

  return (
    <section aria-labelledby="member-actions-heading" className="rounded-2xl border border-astera-border bg-astera-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-astera-service">MEMBER ACTIONS</p>
          <h1 id="member-actions-heading" className="mt-2 font-serif text-2xl sm:text-3xl">需要你處理</h1>
        </div>
        <Link href="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand">查看我的訂單</Link>
      </div>

      {state === "loading" ? (
        <div aria-live="polite" aria-busy="true" className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-astera-brand-soft" />)}
          <p className="sr-only">會員待辦載入中。</p>
        </div>
      ) : state === "error" ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p role="alert">待處理事項讀取失敗，請稍後再試。</p>
          <button type="button" onClick={() => void loadActions()} className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 font-semibold">重新載入</button>
        </div>
      ) : actions.length === 0 ? (
        <div className="mt-5 rounded-xl bg-astera-page p-5">
          <p className="font-semibold">目前無待處理事項</p>
          <p className="mt-2 text-sm leading-6 text-astera-secondary">有新的付款、取消或退款事項時，會顯示在這裡。</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.id} href={action.href} className="rounded-xl border border-astera-border bg-astera-page p-4 transition-colors hover:border-astera-service">
              <h2 className="font-semibold text-astera-service">{action.title}</h2>
              <p className="mt-2 text-sm text-astera-ink">{action.description}</p>
              {action.dueAt ? <p className="mt-2 text-xs text-astera-secondary">期限：{formatTaipeiDate(action.dueAt)}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function dateValue(value: string | undefined) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function formatTaipeiDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "依訂單公告";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
