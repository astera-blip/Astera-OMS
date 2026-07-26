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
  status: "draft" | "open" | "closed" | "archived";
  requiresSupplement: boolean;
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
  const { role } = useAuth();
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

      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);
      const firestoreProducts = await listPublicProducts(db);

      if (firestoreProducts.length === 0) {
        return;
      }

      const workspaceProducts = firestoreProducts.map((entry) => ({
        product: {
          id: entry.product.id,
          name: entry.product.name,
          publicDescription: entry.product.publicDescription,
          publishState: entry.product.publishState,
          createdAt: new Date().toISOString(),
          createdBy: "system" as const,
        },
        variants: entry.variants.map((variant) => ({
          ...variant,
          createdAt: new Date().toISOString(),
          createdBy: "system" as const,
        })),
        campaigns: entry.campaigns.map((campaign) => ({
          ...campaign,
          createdAt: new Date().toISOString(),
          createdBy: "system" as const,
        })),
      }));

      setProducts(workspaceProducts);
      selectProduct(workspaceProducts[0]);
    }

    void loadFirestoreProducts().catch(() => setMessage("無法載入 Firestore 商品，先使用本機資料。"));
  }, [role]);

  useEffect(() => {
    async function loadFirestoreClassifications() {
      if (role !== "owner") {
        return;
      }

      const [{ db }, { listCatalogClassifications }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/classificationRepository"),
      ]);
      const entries = await Promise.all(
        (Object.keys(classificationLabels) as ProductClassificationKey[]).map(
          async (key): Promise<[ProductClassificationKey, CatalogClassification[]]> => [
            key,
            await listCatalogClassifications(db, key),
          ],
        ),
      );
      const next = { ...seedClassifications };

      entries.forEach(([key, values]) => {
        if (values.length > 0) {
          next[key] = values;
        }
      });
      setClassifications(next);
    }

    void loadFirestoreClassifications().catch(() =>
      setMessage("無法載入 Firestore 分類主檔，先使用本機資料。"),
    );
  }, [role]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.product.id === selectedId) ?? null,
    [products, selectedId],
  );

  const [productForm, setProductForm] = useState<ProductFormState>(() =>
    buildProductForm(initialProduct, "prod_002"),
  );
  const [variantForm, setVariantForm] = useState<VariantFormState>(() =>
    buildVariantForm(initialProduct, "var_002"),
  );
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(() =>
    buildCampaignForm(initialProduct, "camp_002"),
  );

  function selectProduct(product: WorkspaceProduct) {
    setSelectedId(product.product.id);
    setProductForm(buildProductForm(product, "prod_002"));
    setVariantForm(buildVariantForm(product, "var_002"));
    setCampaignForm(buildCampaignForm(product, "camp_002"));
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
      variants: [
        {
          id: variantForm.id.trim(),
          sku: variantForm.sku,
          name: variantForm.name,
          isDefault: variantForm.isDefault,
          priceTwd: Number(variantForm.priceTwd),
          ...(variantForm.originalCurrency ? { originalCurrency: variantForm.originalCurrency } : {}),
          ...(variantForm.originalCost ? { originalCost: Number(variantForm.originalCost) } : {}),
        },
      ],
      campaigns: [
        {
          id: campaignForm.id.trim(),
          title: campaignForm.title,
          saleType: campaignForm.saleType,
          status: campaignForm.status,
          requiresSupplement: campaignForm.requiresSupplement,
        },
      ],
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
        const [{ db }, { saveProductCatalogRecord }] = await Promise.all([
          import("@/lib/firebase/client"),
          import("@/lib/product/repository"),
        ]);
        await saveProductCatalogRecord(db, nextProduct, nextProduct.internalNote);
      } catch {
        setMessage("商品已儲存在本機，但 Firestore 同步失敗。");
        return;
      }
    }
    setSelectedId(nextProduct.product.id);
    setMessage(`已儲存 ${nextProduct.product.name}。`);
  }

  function createBlankProduct() {
    const nextId = `prod_${String(products.length + 1).padStart(3, "0")}`;
    setSelectedId(nextId);
    setProductForm({
      id: nextId,
      name: "",
      publicDescription: "",
      publishState: "draft",
        internalNote: "",
        companyId: "",
        artistId: "",
        cpId: "",
        brandId: "",
        seriesId: "",
      });
    setVariantForm({
      id: `var_${String(products.length + 1).padStart(3, "0")}`,
      sku: "",
      name: "Default Variant",
      isDefault: true,
      priceTwd: "0",
      originalCurrency: "",
      originalCost: "",
    });
    setCampaignForm({
      id: `camp_${String(products.length + 1).padStart(3, "0")}`,
      title: "",
      saleType: "preorder",
      status: "draft",
      requiresSupplement: false,
    });
    setMessage("已建立新商品草稿。");
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
        const [{ db }, { saveCatalogClassification }] = await Promise.all([
          import("@/lib/firebase/client"),
          import("@/lib/product/classificationRepository"),
        ]);
        await saveCatalogClassification(db, classificationForm.key, normalized);
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
                <span className="font-medium">商品 ID</span>
                <input
                  value={productForm.id}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, id: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3"
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
                <legend className="px-1 text-sm font-semibold">Default Variant</legend>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">SKU</span>
                  <input
                    value={variantForm.sku}
                    onChange={(event) =>
                      setVariantForm((current) => ({ ...current, sku: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">規格名稱</span>
                  <input
                    value={variantForm.name}
                    onChange={(event) =>
                      setVariantForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">售價 TWD</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={variantForm.priceTwd}
                      onChange={(event) =>
                        setVariantForm((current) => ({ ...current, priceTwd: event.target.value }))
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">原幣成本</span>
                    <input
                      value={variantForm.originalCost}
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          originalCost: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">原幣別</span>
                  <select
                    value={variantForm.originalCurrency}
                    onChange={(event) =>
                      setVariantForm((current) => ({
                        ...current,
                        originalCurrency: event.target.value as VariantFormState["originalCurrency"],
                      }))
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  >
                    <option value="">未設定</option>
                    <option value="TWD">TWD</option>
                    <option value="THB">THB</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </fieldset>

              <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold">Sale Campaign</legend>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">活動名稱</span>
                  <input
                    value={campaignForm.title}
                    onChange={(event) =>
                      setCampaignForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Sale Type</span>
                    <select
                      value={campaignForm.saleType}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          saleType: event.target.value as CampaignFormState["saleType"],
                        }))
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-3"
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
                      value={campaignForm.status}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          status: event.target.value as CampaignFormState["status"],
                        }))
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      <option value="draft">draft</option>
                      <option value="open">open</option>
                      <option value="closed">closed</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={campaignForm.requiresSupplement}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        requiresSupplement: event.target.checked,
                      }))
                    }
                  />
                  <span>需要二補</span>
                </label>
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
    publishState: product?.product.publishState ?? "draft",
    internalNote: product?.internalNote ?? "",
    companyId: product?.product.classifications?.company?.id ?? "",
    artistId: product?.product.classifications?.artist?.id ?? "",
    cpId: product?.product.classifications?.cp?.id ?? "",
    brandId: product?.product.classifications?.brand?.id ?? "",
    seriesId: product?.product.classifications?.series?.id ?? "",
  };
}

function buildVariantForm(
  product: WorkspaceProduct | null,
  fallbackId: string,
): VariantFormState {
  const defaultVariant =
    product?.variants.find((variant) => variant.isDefault) ?? product?.variants[0];

  return {
    id: defaultVariant?.id ?? fallbackId,
    sku: defaultVariant?.sku ?? "",
    name: defaultVariant?.name ?? "Default Variant",
    isDefault: defaultVariant?.isDefault ?? true,
    priceTwd: String(defaultVariant?.priceTwd ?? 0),
    originalCurrency: defaultVariant?.originalCurrency ?? "",
    originalCost: defaultVariant?.originalCost ? String(defaultVariant.originalCost) : "",
  };
}

function buildCampaignForm(
  product: WorkspaceProduct | null,
  fallbackId: string,
): CampaignFormState {
  const campaign = product?.campaigns[0];

  return {
    id: campaign?.id ?? fallbackId,
    title: campaign?.title ?? "",
    saleType: campaign?.saleType ?? "preorder",
    status: campaign?.status ?? "draft",
    requiresSupplement: campaign?.requiresSupplement ?? false,
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
