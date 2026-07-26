"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadPaymentRequests } from "@/lib/order/localStore";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export function PaymentRequestsBoard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LocalPaymentRequest[]>(() => loadPaymentRequests());

  useEffect(() => {
    async function loadFirestoreRequests() {
      if (!user) {
        return;
      }

      const [{ db }, { listMemberPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/payment/repository"),
      ]);
      setRequests(await listMemberPaymentRequests(db, user.uid));
    }

    void loadFirestoreRequests();
  }, [user]);

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
