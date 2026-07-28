"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PublishState } from "@/domain/common";
import {
  buildPublicProductProjection,
  normalizeProductDraft,
  type ProductCatalogRecord,
  type ProductClassificationKey,
  type ProductClassifications,
} from "@/lib/product/catalog";
import {
  normalizeCatalogClassification,
  type CatalogClassification,
  type CatalogClassificationStatus,
} from "@/lib/product/classifications";
import {
  getNewProductFormDefaults,
  getNewVariantFormDefaults,
} from "@/lib/product/workspaceDefaults";

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

type ClassificationFormState = {
  key: ProductClassificationKey;
  id: string;
  label: string;
  status: CatalogClassificationStatus;
};

type ClassificationMasters = Record<ProductClassificationKey, CatalogClassification[]>;

const storageKey = "astera-products-workspace-v1";
const classificationStorageKey = "astera-product-classifications-v1";

const classificationLabels: Record<ProductClassificationKey, string> = {
  company: "公司",
  artist: "藝人",
  cp: "CP",
  brand: "品牌",
  series: "系列",
};

const seedClassifications: ClassificationMasters = {
  company: [{ id: "company_001", label: "Astera Goods", status: "active" }],
  artist: [{ id: "artist_001", label: "Luna", status: "active" }],
  cp: [{ id: "cp_001", label: "Luna x Mira", status: "active" }],
  brand: [{ id: "brand_001", label: "Official Shop", status: "active" }],
  series: [{ id: "series_001", label: "2026 Summer", status: "active" }],
};

export function ProductWorkspace() {
  const { role, user } = useAuth();
  const initialProducts = loadWorkspaceProducts();
  const initialProduct = initialProducts[0] ?? null;
  const [products, setProducts] = useState<WorkspaceProduct[]>(initialProducts);
  const [classifications, setClassifications] = useState<ClassificationMasters>(() =>
    loadClassificationMasters(),
  );
  const [selectedId, setSelectedId] = useState(initialProduct?.product.id ?? "");
  const [message, setMessage] = useState("已載入本機商品工作區。");
  const [classificationForm, setClassificationForm] = useState<ClassificationFormState>({
    key: "company",
    id: "company_002",
    label: "",
    status: "active",
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    window.localStorage.setItem(classificationStorageKey, JSON.stringify(classifications));
  }, [classifications]);

  useEffect(() => {
    async function loadFirestoreProducts() {
      if (role !== "owner") {
        return;
      }

      const token = await user?.getIdToken();
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

      if (workspaceProducts.length === 0) {
        return;
      }

      setProducts(workspaceProducts);
      selectProduct(workspaceProducts[0]);
    }

    void loadFirestoreProducts().catch(() => setMessage("無法載入 Firestore 商品，先使用本機資料。"));
  }, [role, user]);

  useEffect(() => {
    async function loadFirestoreClassifications() {
      if (role !== "owner") {
        return;
      }

      const token = await user?.getIdToken();
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
      const next = { ...seedClassifications };

      Object.entries(payload.classifications ?? {}).forEach(([key, values]) => {
        if (values && values.length > 0) {
          next[key as ProductClassificationKey] = values;
        }
      });
      setClassifications(next);
    }

    void loadFirestoreClassifications().catch(() =>
      setMessage("無法載入 Firestore 分類主檔，先使用本機資料。"),
    );
  }, [role, user]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.product.id === selectedId) ?? null,
    [products, selectedId],
  );

  const [productForm, setProductForm] = useState<ProductFormState>(() =>
    buildProductForm(initialProduct, "prod_002"),
  );
  const [variantForms, setVariantForms] = useState<VariantFormState[]>(() =>
    buildVariantForms(initialProduct),
  );
  const [campaignForms, setCampaignForms] = useState<CampaignFormState[]>(() =>
    buildCampaignForms(initialProduct),
  );

  function selectProduct(product: WorkspaceProduct) {
    setSelectedId(product.product.id);
    setProductForm(buildProductForm(product, "prod_002"));
    setVariantForms(buildVariantForms(product));
    setCampaignForms(buildCampaignForms(product));
  }

  async function upsertCurrentProduct() {
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

    setProducts((current) => {
      const index = current.findIndex((item) => item.product.id === nextProduct.product.id);

      if (index >= 0) {
        const updated = [...current];
        updated[index] = nextProduct;
        return updated;
      }

      return [nextProduct, ...current];
    });
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
        setMessage("商品已儲存在本機，但 Firestore 同步失敗。");
        return;
      }
    }
    setSelectedId(nextProduct.product.id);
    setMessage(`已儲存 ${nextProduct.product.name}。`);
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

  async function upsertClassification() {
    const normalized = normalizeCatalogClassification(classificationForm);

    if (!normalized.id || !normalized.label) {
      setMessage("請填寫分類 ID 與名稱。");
      return;
    }

    setClassifications((current) => {
      const existing = current[classificationForm.key];
      const index = existing.findIndex((entry) => entry.id === normalized.id);
      const nextEntries = [...existing];

      if (index >= 0) {
        nextEntries[index] = normalized;
      } else {
        nextEntries.unshift(normalized);
      }

      return { ...current, [classificationForm.key]: nextEntries };
    });

    if (role === "owner") {
      try {
        const token = await user?.getIdToken();
        if (!token) {
          throw new Error("missing_token");
        }
        const response = await fetch("/api/workspace/classifications", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            key: classificationForm.key,
            classification: normalized,
          }),
        });
        if (!response.ok) {
          throw new Error("save_classification_failed");
        }
      } catch {
        setMessage("分類已儲存在本機，但 Firestore 同步失敗。");
        return;
      }
    }

    setMessage(`已儲存${classificationLabels[classificationForm.key]} ${normalized.label}。`);
    setClassificationForm((current) => ({ ...current, label: "" }));
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
                Phase 2
              </p>
              <h2 className="mt-2 text-2xl font-semibold">商品後台完整化</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                這個頁面先以本機資料做 CRUD，涵蓋商品、Default Variant、Sale Campaign 與公開/內部欄位分離。
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
              <button type="submit" className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">
                儲存商品
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">系統商品 ID</span>
                <input
                  value={productForm.id || "儲存時自動建立"}
                  readOnly
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">商品名稱</span>
                <input
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">公開說明</span>
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
                <span className="font-medium">內部備註</span>
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
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">刊登狀態</span>
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
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {(["company", "artist", "cp", "brand", "series"] as ProductClassificationKey[]).map(
                  (key) => (
                    <label key={key} className="grid gap-2 text-sm">
                      <span className="font-medium">{classificationLabels[key]}</span>
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
                    </label>
                  ),
                )}
              </div>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Variant 與 Campaign</h3>
              <button
                type="button"
                onClick={archiveSelectedProduct}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                封存商品
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="px-1 text-sm font-semibold">Variants</legend>
                  <button
                    type="button"
                    onClick={addVariantForm}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    新增 Variant
                  </button>
                </div>
                {variantForms.map((variant, index) => (
                  <div key={`${variant.id}-${index}`} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Variant {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => archiveVariantForm(index)}
                        className="text-xs font-medium text-rose-600"
                      >
                        移除
                      </button>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">SKU</span>
                      <input
                        value={variant.sku || "儲存時自動派發"}
                        readOnly
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500"
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">規格名稱</span>
                      <input
                        value={variant.name}
                        onChange={(event) => updateVariantForm(index, { name: event.target.value })}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">售價 TWD</span>
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
                        <span className="font-medium">原幣成本</span>
                        <input
                          value={variant.originalCost}
                          onChange={(event) => updateVariantForm(index, { originalCost: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">原幣別</span>
                        <select
                          value={variant.originalCurrency}
                          onChange={(event) =>
                            updateVariantForm(index, {
                              originalCurrency: event.target.value as VariantFormState["originalCurrency"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          <option value="">未設定</option>
                          <option value="TWD">TWD</option>
                          <option value="THB">THB</option>
                          <option value="JPY">JPY</option>
                          <option value="KRW">KRW</option>
                          <option value="USD">USD</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-3 self-end text-sm">
                        <input
                          type="checkbox"
                          checked={variant.isDefault}
                          onChange={(event) => updateVariantForm(index, { isDefault: event.target.checked })}
                        />
                        <span>設為 Default Variant</span>
                      </label>
                    </div>
                  </div>
                ))}
              </fieldset>

              <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="px-1 text-sm font-semibold">Sale Campaigns</legend>
                  <button
                    type="button"
                    onClick={addCampaignForm}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    新增 Campaign
                  </button>
                </div>
                {campaignForms.map((campaign, index) => (
                  <div key={`${campaign.id}-${index}`} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Campaign {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => archiveCampaignForm(index)}
                        className="text-xs font-medium text-rose-600"
                      >
                        封存
                      </button>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">活動名稱</span>
                      <input
                        value={campaign.title}
                        onChange={(event) => updateCampaignForm(index, { title: event.target.value })}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Sale Type</span>
                        <select
                          value={campaign.saleType}
                          onChange={(event) =>
                            updateCampaignForm(index, {
                              saleType: event.target.value as CampaignFormState["saleType"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          <option value="inStock">inStock</option>
                          <option value="preorder">preorder</option>
                          <option value="rushPurchase">rushPurchase</option>
                          <option value="waitlist">waitlist</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">狀態</span>
                        <select
                          value={campaign.status}
                          onChange={(event) =>
                            updateCampaignForm(index, {
                              status: event.target.value as CampaignFormState["status"],
                            })
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        >
                          <option value="upcoming">upcoming</option>
                          <option value="open">open</option>
                          <option value="closed">closed</option>
                          <option value="archived">archived</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">活動價 TWD</span>
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
                      <span>需要二補</span>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">開始時間</span>
                        <input
                          type="datetime-local"
                          value={campaign.startsAt}
                          onChange={(event) => updateCampaignForm(index, { startsAt: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">結單時間</span>
                        <input
                          type="datetime-local"
                          value={campaign.endsAt}
                          onChange={(event) => updateCampaignForm(index, { endsAt: event.target.value })}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">公開提醒</span>
                      <textarea
                        value={campaign.publicNotice}
                        onChange={(event) => updateCampaignForm(index, { publicNotice: event.target.value })}
                        className="min-h-20 rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        placeholder="例如：此商品需等待官方公布配貨結果。"
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">二補說明</span>
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

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">分類主檔</h3>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                <select
                  value={classificationForm.key}
                  onChange={(event) =>
                    setClassificationForm((current) => ({
                      ...current,
                      key: event.target.value as ProductClassificationKey,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                >
                  {Object.entries(classificationLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={classificationForm.id}
                  onChange={(event) =>
                    setClassificationForm((current) => ({ ...current, id: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="分類 ID"
                />
              </div>
              <input
                value={classificationForm.label}
                onChange={(event) =>
                  setClassificationForm((current) => ({ ...current, label: event.target.value }))
                }
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="顯示名稱"
              />
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={classificationForm.status}
                  onChange={(event) =>
                    setClassificationForm((current) => ({
                      ...current,
                      status: event.target.value as CatalogClassificationStatus,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
                <button
                  type="button"
                  onClick={() => void upsertClassification()}
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  儲存分類
                </button>
              </div>
              <div className="grid gap-2 text-sm text-slate-600">
                {Object.entries(classifications).map(([key, entries]) => (
                  <p key={key}>
                    <span className="font-medium text-slate-900">
                      {classificationLabels[key as ProductClassificationKey]}：
                    </span>
                    {entries.map((entry) => `${entry.label} (${entry.status})`).join("、")}
                  </p>
                ))}
              </div>
            </div>
          </section>

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

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">公開 projection</h3>
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {JSON.stringify(selectedProduct ? buildPublicProductProjection(selectedProduct) : null, null, 2)}
            </pre>
          </section>
        </div>
      </section>
    </div>
  );
}

function loadWorkspaceProducts() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceProduct[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
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

function loadClassificationMasters(): ClassificationMasters {
  if (typeof window === "undefined") {
    return seedClassifications;
  }

  const raw = window.localStorage.getItem(classificationStorageKey);

  if (!raw) {
    return seedClassifications;
  }

  try {
    const parsed = JSON.parse(raw) as ClassificationMasters;
    return {
      company: parsed.company ?? seedClassifications.company,
      artist: parsed.artist ?? seedClassifications.artist,
      cp: parsed.cp ?? seedClassifications.cp,
      brand: parsed.brand ?? seedClassifications.brand,
      series: parsed.series ?? seedClassifications.series,
    };
  } catch {
    window.localStorage.removeItem(classificationStorageKey);
    return seedClassifications;
  }
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
