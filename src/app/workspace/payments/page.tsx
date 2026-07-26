"use client";

import { useEffect, useState } from "react";
import { loadPaymentRequests, loadPayments, type PaymentAdminRecord, type PaymentRequestAdminRecord } from "@/lib/payment/adminRepository";

export default function WorkspacePaymentsPage() {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestAdminRecord[]>([]);
  const [payments, setPayments] = useState<PaymentAdminRecord[]>([]);

  useEffect(() => {
    void import("@/lib/firebase/client").then(({ db }) =>
      Promise.all([loadPaymentRequests(db), loadPayments(db)]).then(([requests, records]) => {
        setPaymentRequests(requests);
        setPayments(records);
      }),
    );
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Payments</h1>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Payment requests</h2>
            <div className="mt-4 grid gap-3">
              {paymentRequests.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有請款單。</p>
              ) : (
                paymentRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{request.id}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      NT$ {request.amountTwd.toLocaleString("zh-TW")} · {request.memberUid}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Payments</h2>
            <div className="mt-4 grid gap-3">
              {payments.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有匯款紀錄。</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{payment.id}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {payment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      NT$ {payment.receivedAmountTwd.toLocaleString("zh-TW")} · {payment.receivedAt}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
