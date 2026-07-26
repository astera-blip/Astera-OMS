import Link from "next/link";
import { OrderDetailBoard } from "@/components/storefront/OrderDetailBoard";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Customer
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">訂單詳情</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            檢視收件資訊、付款請求與訂單項目 snapshot。
          </p>
          <Link href="/orders" className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            回訂單列表
          </Link>
        </div>

        <div className="mt-6">
          <OrderDetailBoard orderId={id} />
        </div>
      </section>
    </main>
  );
}
