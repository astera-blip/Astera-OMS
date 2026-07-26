"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPublicProducts, type PublicProductProjection } from "@/lib/product/repository";

export function PublicProductCatalog() {
  const [products, setProducts] = useState<PublicProductProjection[]>([]);

  useEffect(() => {
    let active = true;

    void import("@/lib/firebase/client")
      .then(({ db }) => loadPublicProducts(db))
      .then((items) => {
        if (active) {
          setProducts(items);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.slug}`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-medium text-slate-500">{product.status}</p>
          <h2 className="mt-2 text-lg font-semibold">{product.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {product.company ?? product.artist ?? product.brand ?? "Public product"}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Default variant: {product.defaultVariantName}
          </p>
        </Link>
      ))}
    </div>
  );
}
