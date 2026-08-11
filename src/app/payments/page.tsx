import { PaymentRequestsBoard } from "@/components/storefront/PaymentRequestsBoard";

export default function PaymentsPage() {
  return (
    <main className="min-h-dvh bg-astera-page px-5 py-8 text-astera-ink sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-service">
            付款服務
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight">付款回報</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-astera-secondary">
            下單後會產生付款請求。請依金額完成銀行匯款，並回報匯款日期、金額、帳號末五碼與匯款人。
          </p>
        </div>

        <div className="mt-6">
          <PaymentRequestsBoard />
        </div>
      </section>
    </main>
  );
}
