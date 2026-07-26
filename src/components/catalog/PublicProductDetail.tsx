"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPublicProducts, type PublicProductProjection } from "@/lib/product/repository";

export function PublicProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<PublicProductProjection | null>(null);

  useEffect(() => {
    let active = true;

    void import("@/lib/firebase/client")
      .then(({ db }) => loadPublicProducts(db))
      .then((items) => {
        if (!active) {
          return;
        }

        setProduct(items.find((item) => item.slug === slug) ?? null);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (!product) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Loading product...</h1>
        <p className="mt-2 text-sm text-slate-600">
          The public projection is loading or the item is missing.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Public catalog
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-3 text-sm text-slate-600">{product.slug}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd>{product.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Default variant</dt>
              <dd>{product.defaultVariantName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">SKU</dt>
              <dd>{product.defaultVariantSku}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Catalog notes</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page only renders the public projection. Internal cost, notes, and
            risk data stay behind staff-only access.
          </p>
          <Link href="/products" className="mt-4 inline-flex text-sm font-medium text-slate-900">
            Back to products
          </Link>
        </div>
      </div>
    </section>
  );
}
