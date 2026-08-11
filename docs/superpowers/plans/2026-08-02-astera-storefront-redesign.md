# Astera Storefront Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將 Astera 公開前台、會員中心與 Owner Workspace 依核定需求重新排版，新增 `/checkout` UI 路由，並把台新 Excel 對帳流程接入受保護的 Owner 工具。

**Architecture:** 保留現有 Firebase Collection、Rules 與 Server API；新增 presentation-only Checkout route，將公開、會員、Workspace 共用 token 但分離 Shell；對帳採 Server 解析與 Owner-only API，Payment 歷史只追加對帳摘要，不覆寫既有金流紀錄。

**Tech Stack:** Next.js 16 App Router、React、TypeScript、Tailwind v4、Firebase Admin SDK、Vitest、Playwright。

## Global Constraints

- 銀行帳戶只在付款回報時要求，建立訂單不檢查帳戶。
- 不修改 Collection 架構，不加入 Member Preorder 或 ERP 功能。
- 前台唯一商品來源是 `productsPublic`。
- Owner 權限只使用 Firebase custom claim。
- 所有互動目標至少 44×44px；所有頁面支援 loading、empty、error、retry。
- 台新對帳檔案完整資料只在受保護 Server／Owner 流程處理。

### Task 1: Checkout 路由與購物車流程分層

**Files:**
- Create: `src/app/checkout/page.tsx`
- Modify: `src/app/cart/page.tsx`
- Modify: `src/components/storefront/CartBoard.tsx`
- Test: `tests/unit/checkoutRoute.test.ts`, `tests/e2e/public-smoke.spec.ts`

- [ ] 新增 `/checkout` 頁面，使用既有 `CartBoard` checkout 區塊與 `/api/checkout`。
- [ ] `/cart` 只保留購物車檢視與前往 Checkout CTA，不修改 Server 商業規則。
- [ ] 未登入與空購物車 CTA 維持 disabled／登入導向。
- [ ] 以 Unit、Playwright 驗證 route、條款同意、Campaign 拆單回應仍一致。

### Task 2: 公開 Header、首頁、Campaign 與商品 Grid

**Files:**
- Modify: `src/components/storefront/StorefrontHeader.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/storefront/FeaturedProductsBoard.tsx`
- Modify: `src/components/storefront/PublicProductsBoard.tsx`
- Modify: `src/components/storefront/PublicProductDetailBoard.tsx`
- Test: `tests/unit/storefrontGrid.test.ts`, `tests/e2e/public-smoke.spec.ts`

- [ ] Header 改為 Logo／商品／Campaign／FAQ／購物車／會員分層。
- [ ] 首頁依 Hero、Campaign、商品、流程、二補、FAQ、Footer 順序呈現。
- [ ] 商品卡使用 4:5 圖片、桌面 4 欄、平板 3 欄、手機 2 欄。
- [ ] 顯示 Sale Type、Campaign、結單時間、剩餘時間與二補 Badge。
- [ ] 移除公開技術文案並保留登入閘門。

### Task 3: 會員中心、銀行帳戶與付款頁 UI

**Files:**
- Modify: `src/app/account/profile/page.tsx`
- Modify: `src/app/account/bank-accounts/page.tsx`
- Modify: `src/components/account/MemberPaymentAccountsBoard.tsx`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`
- Modify: `src/app/orders/page.tsx`
- Test: existing member/payment Unit and authenticated Playwright tests

- [ ] 會員頁採服務色 Dashboard 骨架與明確待辦狀態。
- [ ] 帳戶頁顯示 0–5 筆、遮罩、使用中／封存申請中狀態與封存操作。
- [ ] 付款頁保留雙帳戶選擇與多付款請求勾選，不將帳戶檢查移到 Checkout。
- [ ] 訂單頁顯示待付款、待確認、已認列、問題、失效、撤銷文字狀態。

### Task 4: Owner Workspace 重排

**Files:**
- Modify: `src/app/workspace/page.tsx`
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Modify: `src/components/workspace/PaymentOperationsBoard.tsx`
- Modify: `src/components/workspace/ContentOperationsBoard.tsx`
- Test: workspace UI and permission Playwright tests

- [ ] Workspace 使用高密度 dashboard，不套用公開 Hero。
- [ ] 導覽分成商品、Campaign、會員、訂單、付款、內容、稽核。
- [ ] 欄位 label、狀態、錯誤與批次操作保持雙語與新 Token。
- [ ] 付款與稽核操作維持 Owner API／custom claim。

### Task 5: 台新 Excel 對帳 API 與 Owner UI

**Files:**
- Create: `src/lib/reconciliation/taishin.ts`
- Create: `src/app/api/workspace/reconciliation/taishin/route.ts`
- Create: `src/components/workspace/TaishinReconciliationBoard.tsx`
- Modify: `src/app/workspace/payments/page.tsx`
- Test: `tests/unit/taishinReconciliation.test.ts`, `tests/unit/taishinReconciliationApi.test.ts`, Rules/Playwright coverage

- [ ] 以提供的 `main.py` 規則解析欄位與末五碼：取備註中最長連續數字的末五碼，金額正規化為整數。
- [ ] API 只允許 Owner；驗證 `.xlsx`、欄位與資料列，回傳安全化匯入摘要。
- [ ] Owner UI 支援上傳、預覽交易、輸入／選擇付款比對資料與顯示成功／未找到／待人工處理。
- [ ] 不保存原始檔案到公開 Storage，不覆寫 Payment、Allocation 或 Audit Log。

### Task 6: RWD、可及性與全套驗證

**Files:**
- Modify: `src/app/globals.css`
- Modify: affected storefront/member/workspace components
- Test: `tests/unit/uiAccessibility.test.ts`, Playwright desktop/mobile suites

- [ ] 驗證 390px、768px、1365px；修正水平溢出與欄位重疊。
- [ ] focus-visible、aria-live、44px 觸控、reduced-motion、loading／empty／error／retry 全面檢查。
- [ ] 執行 `npm run typecheck`、`npm run lint`、`npm run test:unit`、`npm run build`、`npm run test:e2e`、`npm run test:e2e:emulated`。
- [ ] 更新 `docs/16_MVPCompletionPlan.md`、`docs/17_ProjectHandoff.md`、Changelog 與 Test Plan。
