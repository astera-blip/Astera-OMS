"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadProducts,
  saveProductWithVariants,
  saveSaleCampaign,
  type ProductRecord,
  type ProductVariantRecord,
  type SaleCampaignRecord,
} from "@/lib/product/repository";

type ProductFormState = {
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  company: string;
  artist: string;
  brand: string;
  series: string;
};

const emptyFormState: ProductFormState = {
  name: "",
  slug: "",
  status: "draft",
  company: "",
  artist: "",
  brand: "",
  series: "",
};

export function ProductWorkspace() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyFormState);

  useEffect(() => {
    let active = true;

    void import("@/lib/firebase/client")
      .then(({ db }) => loadProducts(db))
      .then((items) => {
        if (active) {
          setProducts(items);
        }
      })
      .catch(() => {
        if (active) {
          setStatus("無法載入商品清單。");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const submitCreate = async () => {
    setStatus(null);
    setIsPending(true);

    try {
      const { db } = await import("@/lib/firebase/client");
      const result = await saveProductWithVariants(db, {
        product: form,
        variants: [],
      });

      if (!result.ok) {
        setStatus("商品資料不完整。");
        return;
      }

      setForm(emptyFormState);
      setStatus("商品已建立。");
      setProducts(await loadProducts(db));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Products</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">商品主檔</h2>
          </div>
          <Link
            href="/workspace/products/new"
            className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            新增商品
          </Link>
        </div>

        <div className="mt-6 grid gap-3">
          {products.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              目前沒有商品。
            </p>
          ) : (
            products.map((product) => (
              <Link
                key={product.id}
                href={`/workspace/products/${product.id}`}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.slug}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {product.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">快速建立商品</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            商品名稱
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Slug
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            公司
            <input
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            藝人
            <input
              value={form.artist}
              onChange={(event) => setForm({ ...form, artist: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            品牌
            <input
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            系列
            <input
              value={form.series}
              onChange={(event) => setForm({ ...form, series: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            狀態
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ProductFormState["status"],
                })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              void submitCreate();
            }}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            建立商品與 Default Variant
          </button>
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function ProductEditor({
  product,
  variants,
  campaigns,
}: {
  product: ProductRecord;
  variants: ProductVariantRecord[];
  campaigns: SaleCampaignRecord[];
}) {
  const [form, setForm] = useState<ProductFormState>({
    name: product.name,
    slug: product.slug,
    status: product.status,
    company: product.company ?? "",
    artist: product.artist ?? "",
    brand: product.brand ?? "",
    series: product.series ?? "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    productId: product.id,
    name: "",
    code: "",
    status: "draft" as const,
    startsAt: "",
    endsAt: "",
  });

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">{product.name}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {product.slug} · variants {variants.length}
        </p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            商品名稱
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Slug
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            公司
            <input
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            藝人
            <input
              value={form.artist}
              onChange={(event) => setForm({ ...form, artist: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            品牌
            <input
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            系列
            <input
              value={form.series}
              onChange={(event) => setForm({ ...form, series: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setIsPending(true);
              void import("@/lib/firebase/client")
                .then(({ db }) =>
                  saveProductWithVariants(db, {
                    product: form,
                    variants,
                  }),
                )
                .then(() => setStatus("商品已更新。"))
                .catch(() => setStatus("無法更新商品。"))
                .finally(() => setIsPending(false));
            }}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            儲存變更
          </button>
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Variants</h3>
        <div className="mt-4 grid gap-3">
          {variants.map((variant) => (
            <div key={variant.id} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">{variant.name}</p>
              <p className="mt-1 text-sm text-slate-500">{variant.sku}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h3 className="text-lg font-semibold">Sale campaigns</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">{campaign.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {campaign.code} · {campaign.startsAt} - {campaign.endsAt}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            活動名稱
            <input
              value={campaignForm.name}
              onChange={(event) =>
                setCampaignForm({ ...campaignForm, name: event.target.value })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            活動代碼
            <input
              value={campaignForm.code}
              onChange={(event) =>
                setCampaignForm({ ...campaignForm, code: event.target.value })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            開始日期
            <input
              type="date"
              value={campaignForm.startsAt}
              onChange={(event) =>
                setCampaignForm({ ...campaignForm, startsAt: event.target.value })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            結束日期
            <input
              type="date"
              value={campaignForm.endsAt}
              onChange={(event) =>
                setCampaignForm({ ...campaignForm, endsAt: event.target.value })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            活動狀態
            <select
              value={campaignForm.status}
              onChange={(event) =>
                setCampaignForm({
                  ...campaignForm,
                  status: event.target.value as typeof campaignForm.status,
                })
              }
              className="h-11 rounded-xl border border-slate-300 px-3 outline-none ring-0 focus:border-slate-900"
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setIsPending(true);
              void import("@/lib/firebase/client")
                .then(({ db }) =>
                  saveSaleCampaign(db, {
                    ...campaignForm,
                    productId: product.id,
                  }),
                )
                .then(() => setStatus("活動已建立。"))
                .catch(() => setStatus("無法建立活動。"))
                .finally(() => setIsPending(false));
            }}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            建立活動
          </button>
        </div>
      </div>
    </section>
  );
}
