"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export function PaymentRequestsBoard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    async function loadFirestoreRequests() {
      if (!user) {
        setRequests([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const [{ db }, { listMemberPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/payment/repository"),
      ]);
      setRequests(await listMemberPaymentRequests(db, user.uid));
      setStatus("ready");
    }

    void loadFirestoreRequests().catch(() => {
      setRequests([]);
      setStatus("error");
    });
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        請先登入，才能查看自己的付款請求。
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        付款請求載入中。
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        付款請求讀取失敗，請稍後再試。
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      {requests.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          目前沒有待付款資料。
        </div>
      ) : (
        requests.map((request) => (
          <article key={request.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{request.id}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  訂單：{request.orderId} · 狀態：{request.status}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                bank transfer
              </span>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p>應付金額：NT$ {request.amountTwd.toLocaleString()}</p>
              <p>付款方式：銀行匯款</p>
              <p>建立時間：{request.createdAt}</p>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
