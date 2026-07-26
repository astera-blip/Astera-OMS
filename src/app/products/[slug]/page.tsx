import { PublicProductDetail } from "@/components/catalog/PublicProductDetail";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <PublicProductDetail slug={slug} />
    </main>
  );
}
