# Astera 首頁登入狀態實作計畫

> **For Codex:** Use the executing-plans and test-driven-development skills. Complete each task in order and keep `/` as the only homepage.

**Goal:** 將已核定的訪客／會員首頁狀態實際套用到既有 `/`，並保留現有 Firebase、`productsPublic`、購物車及訂單流程。

**Architecture:** `page.tsx` 保持 Server Component，只承載首頁 Client boundary。新增 `HomeExperience` 依 `AuthProvider` 狀態切換訪客／會員資訊架構；首頁商品元件只讀 `productsPublic`，共用既有商品圖片、有效價格、Campaign 與待登入購物車意圖。會員待辦只讀該會員既有 Order／PaymentRequest，最多顯示三項需要動作的資料。

**Tech Stack:** Next.js 16 App Router、React、TypeScript、Firebase Auth／Firestore、Tailwind CSS、Vitest、Playwright。

---

## Task 1：首頁排序與狀態回歸測試

**Files:**
- Modify: `tests/unit/featuredProducts.test.ts`
- Modify: `tests/e2e/public-home.spec.ts`

1. 新增「最新商品」與「即將結單」排序的行為測試。
2. 將公開首頁 E2E 改成核定順序、訪客導覽、會員首頁與 390／768／1365 欄數驗收。
3. 執行 focused tests，確認在實作前因缺少新介面而失敗。

## Task 2：商品首頁資料與卡片

**Files:**
- Modify: `src/lib/catalog/featuredProducts.ts`
- Replace: `src/components/storefront/FeaturedProductsBoard.tsx`
- Add: `src/components/storefront/HomeProductCard.tsx`

1. 實作最新商品與即將結單的純函式排序。
2. 保留現有公開商品讀取、登入前購物車意圖與登入後權威重驗證。
3. 實作訪客兩張販售卡、會員兩組四欄／兩欄商品 Grid，以及 loading／empty／error／retry。
4. 跑 Unit 與公開首頁 E2E 至通過。

## Task 3：訪客／會員首頁與 Header

**Files:**
- Modify: `src/app/page.tsx`
- Add: `src/components/storefront/HomeExperience.tsx`
- Add: `src/components/storefront/MemberHomeActions.tsx`
- Modify: `src/components/storefront/StorefrontHeader.tsx`
- Modify: `src/components/auth/AccountActions.tsx`

1. 訪客首頁依序實作會員登入卡、三步驟卡、正在販售。
2. 會員首頁依序實作需要你處理、最新商品、即將結單。
3. 訪客 Header 隱藏購物車並以同樣純文字樣式顯示會員登入；會員 Header 保留購物車、訂單與角色入口。
4. 驗證首次 Profile guard、Owner custom claim 與既有登入流程沒有改變。

## Task 4：完整驗證與 Preview

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

1. 依序執行 TypeScript、ESLint、Unit、Rules、Build、一般及 Emulator Playwright。
2. 在 390、768、1365 實際檢查無水平溢出、訪客兩卡與會員商品欄數。
3. 更新交接文件，提交並推送 `codex/storefront-product-order`。
4. 等待 Vercel Preview Ready，驗證 `/` 顯示新版首頁；不部署 Production。
