"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CopyValueButton } from "@/components/workspace/CopyValueButton";
import { ProductClassificationManager } from "@/components/workspace/ProductClassificationManager";
import { ProductImageManager } from "@/components/workspace/ProductImageManager";
import type { PublishState } from "@/domain/common";
import {
  buildPublicProductProjection,
  normalizeProductDraft,
  type ProductCatalogRecord,
  type ProductClassificationKey,
  type ProductClassifications,
} from "@/lib/product/catalog";
import type { CatalogClassification } from "@/lib/product/classifications";
import {
  getNewProductFormDefaults,
  getNewVariantFormDefaults,
} from "@/lib/product/workspaceDefaults";
import {
  campaignStatusLabels,
  currencyOptions,
  publishStateLabels,
  saleTypeLabels,
} from "@/lib/product/workspaceLabels";

type WorkspaceProduct = ProductCatalogRecord & {
  internalNote?: string;
};

type ProductFormState = {
  id: string;
  name: string;
  publicDescription: string;
  publishState: PublishState;
  internalNote: string;
  companyId: string;
  artistId: string;
  cpId: string;
  brandId: string;
  seriesId: string;
};

type VariantFormState = {
  id: string;
  sku: string;
  name: string;
  isDefault: boolean;
  priceTwd: string;
  originalCurrency: "" | "TWD" | "THB" | "JPY" | "KRW" | "USD";
  originalCost: string;
};

type CampaignFormState = {
  id: string;
  title: string;
  saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
  status: "upcoming" | "open" | "closed" | "archived";
  salePriceTwd: string;
  requiresSupplement: boolean;
  startsAt: string;
  endsAt: string;
  publicNotice: string;
  supplementNote: string;
};

type ClassificationMasters = Record<ProductClassificationKey, CatalogClassification[]>;

const classificationLabels: Record<ProductClassificationKey, string> = {
  company: "公司",
  artist: "藝人",
  cp: "CP",
  brand: "品牌",
  series: "系列",
};

const emptyClassifications: ClassificationMasters = {
  company: [],
  artist: [],
  cp: [],
  brand: [],
  series: [],
};

export function ProductWorkspace() {
  const { role, user } = useAuth();
  const productsLoadedForUid = useRef("");
  const classificationsLoadedForUid = useRef("");
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [classifications, setClassifications] =
    useState<ClassificationMasters>(emptyClassifications);
  const [selectedId, setSelectedId] = useState("");
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [message, setMessage] = useState("商品資料載入中。");
  const [activeTab, setActiveTab] = useState<"products" | "classifications">("products");
  const [activeClassificationKey, setActiveClassificationKey] =
    useState<ProductClassificationKey>("company");

  useEffect(() => {
    const ownerUser = user;
    if (role !== "owner" || !ownerUser) {
      queueMicrotask(() => setIsProductsLoading(false));
      return;
    }
    if (productsLoadedForUid.current === ownerUser.uid) {
      queueMicrotask(() => setIsProductsLoading(false));
      return;
    }

    async function loadFirestoreProducts(authenticatedUser: NonNullable<typeof user>) {
      productsLoadedForUid.current = authenticatedUser.uid;

      const token = await authenticatedUser.getIdToken();
      if (!token) {
        return;
      }
      const response = await fetch("/api/workspace/products", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("load_products_failed");
      }
      const payload = (await response.json()) as { products?: WorkspaceProduct[] };
      const workspaceProducts = payload.products ?? [];

      setProducts(workspaceProducts);
      if (workspaceProducts[0]) {
        selectProduct(workspaceProducts[0]);
      }
      setMessage(workspaceProducts.length > 0 ? "商品資料已載入。" : "目前沒有商品。");
    }

    void loadFirestoreProducts(ownerUser)
      .catch(() => {
        productsLoadedForUid.current = "";
        setMessage("無法載入商品資料，請確認網路後再試一次。");
      })
      .finally(() => setIsProductsLoading(false));
  }, [role, user]);

  useEffect(() => {
    async function loadFirestoreClassifications() {
      if (
        role !== "owner"
        || !user
        || classificationsLoadedForUid.current === user.uid
      ) {
        return;
      }
      classificationsLoadedForUid.current = user.uid;

      const token = await user.getIdToken();
      if (!token) {
        return;
      }
      const response = await fetch("/api/workspace/classifications", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("load_classifications_failed");
      }
      const payload = (await response.json()) as { classifications?: Partial<ClassificationMasters> };
      const next: ClassificationMasters = {
        company: [],
        artist: [],
        cp: [],
        brand: [],
        series: [],
      };

      Object.entries(payload.classifications ?? {}).forEach(([key, values]) => {
        next[key as ProductClassificationKey] = values ?? [];
      });
      setClassifications(next);
    }

    void loadFirestoreClassifications().catch(() => {
      classificationsLoadedForUid.current = "";
      setMessage("無法載入分類主檔，請確認網路後再試一次。");
    });
  }, [role, user]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.product.id === selectedId) ?? null,
    [products, selectedId],
  );

  const [productForm, setProductForm] = useState<ProductFormState>(() =>
    buildProductForm(null, ""),
  );
  const [variantForms, setVariantForms] = useState<VariantFormState[]>(() =>
    buildVariantForms(null),
  );
  const [campaignForms, setCampaignForms] = useState<CampaignFormState[]>(() =>
    buildCampaignForms(null),
  );

  function selectProduct(product: WorkspaceProduct) {
    setSelectedId(product.product.id);
    setProductForm(buildProductForm(product, "prod_002"));
    setVariantForms(buildVariantForms(product));
    setCampaignForms(buildCampaignForms(product));
  }

  async function upsertCurrentProduct() {
    if (isProductsLoading) {
      setMessage("商品資料仍在載入中，請稍候。");
      return;
    }

    const result = normalizeProductDraft({
      product: {
        id: productForm.id.trim(),
        name: productForm.name,
        publicDescription: productForm.publicDescription,
        publishState: productForm.publishState,
        classifications: buildSelectedClassifications(productForm, classifications),
      },
      variants: variantForms.map((variant) => ({
          id: variant.id.trim(),
          sku: "",
          name: variant.name,
          isDefault: variant.isDefault,
          priceTwd: Number(variant.priceTwd),
          ...(variant.originalCurrency ? { originalCurrency: variant.originalCurrency } : {}),
          ...(variant.originalCost ? { originalCost: Number(variant.originalCost) } : {}),
        })),
      campaigns: campaignForms.map((campaign) => ({
          id: campaign.id.trim(),
          title: campaign.title,
          saleType: campaign.saleType,
          status: campaign.status,
          ...(campaign.salePriceTwd ? { salePriceTwd: Number(campaign.salePriceTwd) } : {}),
          requiresSupplement: campaign.requiresSupplement,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          publicNotice: campaign.publicNotice,
          supplementNote: campaign.supplementNote,
        })),
    });

    if (!result.ok) {
      const variantError = result.errors.variants?.[0];
      const campaignError = result.errors.campaigns?.[0];
      setMessage(
        [
          result.errors.name,
          result.errors.publicDescription,
          variantError?.sku,
          variantError?.name,
          variantError?.priceTwd,
          campaignError?.title,
          campaignError?.startsAt,
          campaignError?.endsAt,
          campaignError?.publicNotice,
          campaignError?.supplementNote,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }

    const nextProduct: WorkspaceProduct = {
      product: {
        ...result.value.product,
        createdAt: selectedProduct?.product.createdAt ?? new Date().toISOString(),
        createdBy: selectedProduct?.product.createdBy ?? "system",
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      },
      variants: result.value.variants.map((variant) => ({
        ...variant,
        createdAt: selectedProduct?.variants[0]?.createdAt ?? new Date().toISOString(),
        createdBy: selectedProduct?.variants[0]?.createdBy ?? "system",
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      })),
      campaigns: result.value.campaigns.map((campaign) => ({
        ...campaign,
        createdAt: selectedProduct?.campaigns[0]?.createdAt ?? new Date().toISOString(),
        createdBy: selectedProduct?.campaigns[0]?.createdBy ?? "system",
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      })),
      internalNote: productForm.internalNote.trim() || undefined,
    };

    if (role === "owner") {
      try {
        const token = await user?.getIdToken();
        if (!token) {
          throw new Error("missing_token");
        }
        const response = await fetch("/api/workspace/products", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            product: result.value.product,
            variants: result.value.variants.map((variant) => ({ ...variant, sku: "" })),
            campaigns: result.value.campaigns,
            internalNote: nextProduct.internalNote,
          }),
        });
        if (!response.ok) {
          throw new Error("save_product_failed");
        }
        const payload = (await response.json()) as { product?: WorkspaceProduct };
        const savedProduct = payload.product;
        if (savedProduct) {
          setProducts((current) => {
            const index = current.findIndex((item) => item.product.id === savedProduct.product.id);

            if (index >= 0) {
              const updated = [...current];
              updated[index] = savedProduct;
              return updated;
            }

            return [savedProduct, ...current];
          });
          setSelectedId(savedProduct.product.id);
          selectProduct(savedProduct);
          setMessage(`已儲存 ${savedProduct.product.name}。`);
          return;
        }
      } catch {
        setMessage("商品儲存失敗，請確認資料與網路後再試一次。");
        return;
      }
    }
    setMessage("需要 Owner 權限才能儲存商品。");
  }

  function createBlankProduct() {
    const nextId = "";
    setSelectedId(nextId);
    setProductForm({
      id: nextId,
      name: "",
      publicDescription: "",
      publishState: getNewProductFormDefaults().publishState,
        internalNote: "",
        companyId: "",
        artistId: "",
        cpId: "",
        brandId: "",
        seriesId: "",
      });
    setVariantForms([buildBlankVariantForm("", true)]);
    setCampaignForms([buildBlankCampaignForm("")]);
    setMessage("已建立新商品草稿。");
  }

  function addVariantForm() {
    setVariantForms((current) => [
      ...current,
      buildBlankVariantForm("", current.length === 0),
    ]);
  }

  function updateVariantForm(index: number, patch: Partial<VariantFormState>) {
    setVariantForms((current) => current.map((variant, currentIndex) => {
      if (currentIndex !== index) {
        return patch.isDefault ? { ...variant, isDefault: false } : variant;
      }

      return { ...variant, ...patch };
    }));
  }

  function archiveVariantForm(index: number) {
    setVariantForms((current) => {
      if (current.length <= 1) {
        setMessage("至少需要保留一個 Variant。");
        return current;
      }

      const next = current.filter((_, currentIndex) => currentIndex !== index);

      return next.some((variant) => variant.isDefault)
        ? next
        : next.map((variant, currentIndex) => ({ ...variant, isDefault: currentIndex === 0 }));
    });
  }

  function addCampaignForm() {
    setCampaignForms((current) => [...current, buildBlankCampaignForm("")]);
  }

  function updateCampaignForm(index: number, patch: Partial<CampaignFormState>) {
    setCampaignForms((current) =>
      current.map((campaign, currentIndex) =>
        currentIndex === index ? { ...campaign, ...patch } : campaign,
      ),
    );
  }

  function archiveCampaignForm(index: number) {
    setCampaignForms((current) =>
      current.map((campaign, currentIndex) =>
        currentIndex === index ? { ...campaign, status: "archived" } : campaign,
      ),
    );
  }

  function updateClassification(
    key: ProductClassificationKey,
    saved: CatalogClassification,
  ) {
    setClassifications((current) => {
      const index = current[key].findIndex((entry) => entry.id === saved.id);
      const nextEntries = [...current[key]];
      if (index >= 0) {
        nextEntries[index] = saved;
      } else {
        nextEntries.unshift(saved);
      }
      return { ...current, [key]: nextEntries };
    });
  }

  function updateProductImages(images: NonNullable<WorkspaceProduct["product"]["images"]>) {
    if (!selectedProduct) {
      return;
    }
    setProducts((current) => current.map((product) =>
      product.product.id === selectedProduct.product.id
        ? { ...product, product: { ...product.product, images } }
        : product));
  }

  function archiveSelectedProduct() {
    if (!selectedProduct) {
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.product.id === selectedProduct.product.id
          ? {
              ...product,
              product: {
                ...product.product,
                publishState: "archived",
                updatedAt: new Date().toISOString(),
                updatedBy: "system",
              },
            }
          : product,
      ),
    );
    setMessage(`已封存 ${selectedProduct.product.name}。`);
  }

  return (
    <div className="grid gap-5">
      <nav className="flex flex-wrap gap-2" aria-label="商品工作區">
        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={[
            "rounded-full px-4 py-2 text-sm font-medium",
            activeTab === "products"
              ? "bg-slate-950 text-white"
              : "border border-slate-300 text-slate-700",
          ].join(" ")}
        >
          Products（商品管理）
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("classifications")}
          className={[
            "rounded-full px-4 py-2 text-sm font-medium",
            activeTab === "classifications"
              ? "bg-slate-950 text-white"
              : "border border-slate-300 text-slate-700",
          ].join(" ")}
        >
          Classifications（分類管理）
        </button>
      </nav>

      {activeTab === "classifications" ? (
        <ProductClassificationManager
          classifications={classifications}
          activeKey={activeClassificationKey}
          onActiveKeyChange={setActiveClassificationKey}
          onChanged={updateClassification}
        />
      ) : (
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Product catalog</p>
            <h2 className="text-xl font-semibold">商品清單</h2>
          </div>
          <button
            type="button"
            onClick={createBlankProduct}
            disabled={isProductsLoading}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            新增
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {products.map((product) => {
            const publicView = buildPublicProductProjection(product);
            const active = product.product.id === selectedId;
            return (
              <button
                key={product.product.id}
                type="button"
                onClick={() => selectProduct(product)}
                disabled={isProductsLoading}
                className={[
                  "rounded-2xl border p-4 text-left transition-colors",
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{publicView.name}</p>
                    <p className="mt-1 text-sm leading-5 opacity-80">
                      {publicView.publicDescription}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium">
                    {publicView.publishState}
                  </span>
                </div>
                <p className="mt-3 text-xs opacity-75">
                  {publicView.variants.length} variants · {publicView.campaigns.length} campaigns
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="grid gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                商品管理
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Products（商品管理）</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                管理商品、商品規格、販售活動，以及公開與內部作業資訊。
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-100">
              {message}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <form
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void upsertCurrentProduct();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">商品資料</h3>
              <button
                type="submit"
                disabled={isProductsLoading}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                儲存商品
              </button>
            </div>
            <fieldset disabled={isProductsLoading} className="mt-4 grid gap-4">
              <div className="grid gap-2 text-sm">
                <span className="font-medium">Product ID（商品識別碼）</span>
                <div className="flex gap-2">
                  <input
                    value={productForm.id || "儲存時自動建立"}
                    readOnly
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                  />
                  <CopyValueButton value={productForm.id} label="Product ID" />
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <span className="font-medium">Product SKU（商品編號）</span>
                <div className="flex gap-2">
                  <input
                    value={selectedProduct?.product.sku || "儲存時自動派發"}
                    readOnly
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                  />
                  <CopyValueButton value={selectedProduct?.product.sku} label="Product SKU" />
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  SKU 由系統自動派發且不可修改；規格封存後編號不回收，新規格會繼續往後編號。
                </p>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Product Name（商品名稱）</span>
                <input
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Public Description（公開說明）</span>
                <textarea
                  value={productForm.publicDescription}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      publicDescription: event.target.value,
                    }))
                  }
                  className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Internal Note（內部備註）</span>
                <textarea
                  value={productForm.internalNote}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      internalNote: event.target.value,
                    }))
                  }
                  className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                />
                <span className="text-xs leading-5 text-slate-500">
                  僅供後台作業使用，不會顯示於商品頁。可記錄採購來源、限購、成本或交接事項。
                </span>
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Publish Status（刊登狀態）</span>
                <select
                  value={productForm.publishState}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      publishState: event.target.value as PublishState,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                >
                  {Object.entries(publishStateLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {(["company", "artist", "cp", "brand", "series"] as ProductClassificationKey[]).map(
                  (key) => (
                    <div key={key} className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{classificationLabels[key]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveClassificationKey(key);
                            setActiveTab("classifications");
                          }}
                          className="text-xs font-medium text-amber-700"
                        >
                          管理分類
                        </button>
                      </div>
                      <select
                        value={productForm[`${key}Id` as keyof ProductFormState]}
                        onChange={(event) =>
                          setProductForm((current) => ({
                            ...current,
                            [`${key}Id`]: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-300 px-4 py-3"
                      >
                        <option value="">未設定</option>
                        {classifications[key]
                          .filter((entry) => entry.status === "active")
                          .map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  ),
                )}
              </div>
            </fieldset>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Variants（商品規格）與 Campaigns（販售活動）</h3>
              <button
                type="button"
                onClick={archiveSelectedProduct}
                disabled={isProductsLoading || !selectedProduct}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                封存商品
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <fieldset disabled={isProductsLoading} className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="px-1 text-sm font-semibold">Variants（商品規格）</legend>
                  <button
                    type="button"
                    onClick={addVariantForm}
                    className="min-h-11 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    新增 Variant（規格）
                  </button>
                </div>
                {variantForms.map((variant, index) => (
                  <div key={`${variant.id}-${index}`} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Variant（規格） {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => archiveVariantForm(index)}
                        className="text-xs font-medium text-rose-600"
                      >
                        移除
                      </button>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <span className="font-medium">Variant SKU（規格編號）</span>
                      <div className="flex gap-2">
                        <input
                          value={variant.sku || "儲存時自動派發"}
                          readOnly
                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500"
                        />
                        <CopyValueButton value={variant.sku} label={`Variant ${index + 1} SKU`} />
                      </div>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Variant Name（規格名稱）</span>
                      <input
                        value={variant.name}
                        onChange={(event) => updateVariantForm(index, { name: event.target.value })}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Default Price TWD（預設售價）</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variant.priceTwd}
                          onChange={(event) => updateVariantForm(index, { priceTwd: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Original Cost（原幣成本）</span>
                        <input
                          value={variant.originalCost}
                          onChange={(event) => updateVariantForm(index, { originalCost: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Original Currency（原幣別）</span>
                        <select
                          value={variant.originalCurrency}
                          onChange={(event) =>
                            updateVariantForm(index, {
                              originalCurrency: event.target.value as VariantFormState["originalCurrency"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          {currencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-3 self-end text-sm">
                        <input
                          type="checkbox"
                          checked={variant.isDefault}
                          onChange={(event) => updateVariantForm(index, { isDefault: event.target.checked })}
                        />
                        <span>Default Variant（預設規格）</span>
                      </label>
                    </div>
                  </div>
                ))}
              </fieldset>

              <fieldset disabled={isProductsLoading} className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="px-1 text-sm font-semibold">Sale Campaigns（販售活動）</legend>
                  <button
                    type="button"
                    onClick={addCampaignForm}
                    className="min-h-11 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    新增 Campaign（活動）
                  </button>
                </div>
                {campaignForms.map((campaign, index) => (
                  <div key={`${campaign.id}-${index}`} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Campaign（活動） {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => archiveCampaignForm(index)}
                        className="text-xs font-medium text-rose-600"
                      >
                        封存
                      </button>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Campaign Name（活動名稱）</span>
                      <input
                        value={campaign.title}
                        onChange={(event) => updateCampaignForm(index, { title: event.target.value })}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Sale Type（販售類型）</span>
                        <select
                          value={campaign.saleType}
                          onChange={(event) =>
                            updateCampaignForm(index, {
                              saleType: event.target.value as CampaignFormState["saleType"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          {Object.entries(saleTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Campaign Status（活動狀態）</span>
                        <select
                          value={campaign.status}
                          onChange={(event) =>
                            updateCampaignForm(index, {
                              status: event.target.value as CampaignFormState["status"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          {Object.entries(campaignStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Sale Price TWD（活動價）</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={campaign.salePriceTwd}
                          onChange={(event) => updateCampaignForm(index, { salePriceTwd: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                          placeholder="未填則用 Variant 售價"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={campaign.requiresSupplement}
                        onChange={(event) => updateCampaignForm(index, { requiresSupplement: event.target.checked })}
                      />
                      <span>Supplement Required（可能需要二補）</span>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Start Time（開始時間）</span>
                        <input
                          type="datetime-local"
                          value={campaign.startsAt}
                          onChange={(event) => updateCampaignForm(index, { startsAt: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">End Time（結單時間）</span>
                        <input
                          type="datetime-local"
                          value={campaign.endsAt}
                          onChange={(event) => updateCampaignForm(index, { endsAt: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Public Notice（公開提醒）</span>
                      <textarea
                        value={campaign.publicNotice}
                        onChange={(event) => updateCampaignForm(index, { publicNotice: event.target.value })}
                        className="min-h-20 rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        placeholder="例如：此商品需等待官方公布配貨結果。"
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Supplement Note（二補說明）</span>
                      <textarea
                        value={campaign.supplementNote}
                        onChange={(event) => updateCampaignForm(index, { supplementNote: event.target.value })}
                        className="min-h-20 rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        placeholder="例如：二補金額依實際國際運費與匯率通知。"
                      />
                    </label>
                  </div>
                ))}
              </fieldset>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <ProductImageManager
            productId={selectedProduct?.product.id ?? ""}
            images={selectedProduct?.product.images ?? []}
            onChanged={updateProductImages}
          />
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">商品預覽</h3>
            {selectedProduct ? (
              <div className="mt-4 grid gap-3 text-sm">
                <p>
                  <span className="font-medium">公開名稱：</span>
                  {selectedProduct.product.name}
                </p>
                <p>
                  <span className="font-medium">公開說明：</span>
                  {selectedProduct.product.publicDescription}
                </p>
                <p>
                  <span className="font-medium">內部備註：</span>
                  {selectedProduct.internalNote ?? "未設定"}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">尚未選擇商品。</p>
            )}
          </section>

        </div>
      </section>
    </div>
      )}
    </div>
  );
}

function buildProductForm(
  product: WorkspaceProduct | null,
  fallbackId: string,
): ProductFormState {
  return {
    id: product?.product.id ?? fallbackId,
    name: product?.product.name ?? "",
    publicDescription: product?.product.publicDescription ?? "",
    publishState: product?.product.publishState ?? getNewProductFormDefaults().publishState,
    internalNote: product?.internalNote ?? "",
    companyId: product?.product.classifications?.company?.id ?? "",
    artistId: product?.product.classifications?.artist?.id ?? "",
    cpId: product?.product.classifications?.cp?.id ?? "",
    brandId: product?.product.classifications?.brand?.id ?? "",
    seriesId: product?.product.classifications?.series?.id ?? "",
  };
}

function buildVariantForms(product: WorkspaceProduct | null): VariantFormState[] {
  if (!product || product.variants.length === 0) {
    return [buildBlankVariantForm("", true)];
  }

  const hasDefault = product.variants.some((variant) => variant.isDefault);

  return product.variants.map((variant, index) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    isDefault: hasDefault ? variant.isDefault : index === 0,
    priceTwd: String(variant.priceTwd),
    originalCurrency: variant.originalCurrency ?? "",
    originalCost: variant.originalCost ? String(variant.originalCost) : "",
  }));
}

function buildBlankVariantForm(id: string, isDefault: boolean): VariantFormState {
  return {
    id,
    sku: "",
    name: isDefault ? "Default Variant" : "",
    isDefault,
    priceTwd: "0",
    originalCurrency: getNewVariantFormDefaults().originalCurrency,
    originalCost: "",
  };
}

function buildCampaignForms(product: WorkspaceProduct | null): CampaignFormState[] {
  if (!product || product.campaigns.length === 0) {
    return [buildBlankCampaignForm("")];
  }

  return product.campaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    saleType: campaign.saleType,
    status: campaign.status,
    salePriceTwd: typeof campaign.salePriceTwd === "number" ? String(campaign.salePriceTwd) : "",
    requiresSupplement: campaign.requiresSupplement,
    startsAt: campaign.startsAt ?? "",
    endsAt: campaign.endsAt ?? "",
    publicNotice: campaign.publicNotice ?? "",
    supplementNote: campaign.supplementNote ?? "",
  }));
}

function buildBlankCampaignForm(id: string): CampaignFormState {
  return {
    id,
    title: "",
    saleType: "preorder",
    status: "upcoming",
    salePriceTwd: "",
    requiresSupplement: false,
    startsAt: "",
    endsAt: "",
    publicNotice: "",
    supplementNote: "",
  };
}

function buildSelectedClassifications(
  form: ProductFormState,
  masters: ClassificationMasters,
): ProductClassifications {
  return {
    company: findClassificationLink(masters.company, form.companyId),
    artist: findClassificationLink(masters.artist, form.artistId),
    cp: findClassificationLink(masters.cp, form.cpId),
    brand: findClassificationLink(masters.brand, form.brandId),
    series: findClassificationLink(masters.series, form.seriesId),
  };
}

function findClassificationLink(entries: CatalogClassification[], id: string) {
  const entry = entries.find((item) => item.id === id);

  return entry ? { id: entry.id, label: entry.label } : undefined;
}
