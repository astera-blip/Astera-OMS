"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductEditor } from "@/components/workspace/product-form";
import {
  loadProduct,
  loadProductVariants,
  loadSaleCampaigns,
  type ProductRecord,
  type ProductVariantRecord,
  type SaleCampaignRecord,
} from "@/lib/product/repository";

export default function WorkspaceProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [variants, setVariants] = useState<ProductVariantRecord[]>([]);
  const [campaigns, setCampaigns] = useState<SaleCampaignRecord[]>([]);

  useEffect(() => {
    let active = true;

    void Promise.resolve(params.id).then(async (id) => {
      const { db } = await import("@/lib/firebase/client");
      const [loadedProduct, loadedVariants, loadedCampaigns] = await Promise.all([
        loadProduct(db, id),
        loadProductVariants(db, id),
        loadSaleCampaigns(db, id),
      ]);

      if (!active) {
        return;
      }

      if (!loadedProduct) {
        setProduct(null);
        return;
      }

      setProduct(loadedProduct);
      setVariants(loadedVariants);
      setCampaigns(loadedCampaigns);
    });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
        <section className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading product...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit Product</h1>
        </div>

        <ProductEditor product={product} variants={variants} campaigns={campaigns} />
      </section>
    </main>
  );
}
