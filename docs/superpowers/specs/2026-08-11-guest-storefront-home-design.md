# Astera 未登入公開首頁重構設計

**日期：** 2026-08-11  
**狀態：** 已確認方向，待使用者檢閱書面規格  
**範圍：** 現有 `/` 首頁與其實際使用的共用前台元件

## 1. 目標與不可變條件

將現有 `/` 從 OMS 說明頁重構為「泰國 GL／藝人周邊會員制代購選物店」公開首頁。商品、Campaign 與結單資訊是主要視覺；流程與服務說明退居下方。

硬性限制：

- 不建立 `/guest-home`、`/new-home`、Mockup 或靜態替代頁。
- 保留 Firebase Authentication、`productsPublic`、Product／Variant／Campaign API、購物車與登入流程。
- 不修改 Firestore Collection、Firebase Rules、Checkout、價格或拆單商業邏輯。
- 公開頁不得顯示 Firestore、Custom Claim、Owner、Audit Log、MVP 或開發階段文字。
- 訪客只接觸公開資料；會員、訂單與付款資料不在首頁載入或呈現。

## 2. 選定方案

重構現有 `FeaturedProductsBoard`，讓它繼續作為首頁唯一公開商品資料容器，讀取 `productsPublic` 並同時產生 Campaign 與商品推薦區。首頁不重用帶篩選器與購物車摘要的完整 `PublicProductsBoard`，也不建立第二套商品 Repository。

這個方案保留既有排序、價格、Campaign 狀態與 Firebase 資料流，只替換公開首頁的資訊架構與互動呈現。

## 3. 首頁結構

`src/app/page.tsx` 僅負責依下列固定順序組版：

1. 共用 `StorefrontHeader`
2. Hero 品牌區
3. `FeaturedProductsBoard` 內的最新 Campaign
4. `FeaturedProductsBoard` 內的推薦商品 Grid
5. 購買流程
6. 二補說明
7. FAQ／客服入口
8. 共用 `StorefrontFooter`

Header 與 Footer 仍由 Root Layout 共用渲染，首頁不複製一份。

## 4. Header 與登入狀態

- 品牌名稱只顯示 `ASTERA`，使用收藏感襯線字體，不出現 OMS／Workspace／Operations。
- 導覽：商品、Campaign／品牌、FAQ／客服。
- 右側：購物車、Google 登入；登入後沿用既有會員入口與登出行為。
- 白色 Surface、細 Border、44px 觸控高度、可見 `focus-visible`。
- 小螢幕可換行或收斂，但不得造成水平溢出或把 CTA 壓成過小目標。

## 5. Hero

- Eyebrow：`ASTERA SELECT`。
- H1：`泰國 GL／藝人周邊代購`。
- 副標只說明實際支援的商品、Campaign、結單時間及銀行匯款流程。
- 主 CTA：`立即看商品`，連到首頁 `#featured-products` 商品區。
- 次 CTA：`了解購買流程`，連到首頁流程錨點。
- 以留白、排版與少量商品／Campaign 摘要建立品牌感，不使用大面積深色資訊卡或假圖片。

## 6. Campaign 區

資料來源為已發布 `productsPublic` 內的正式 Campaign projection。依現有推薦邏輯去重，相同 Campaign 只顯示一次，且其下商品共享同一 `endsAt`。

每張卡顯示：

- Campaign 名稱。
- 可用的 Artist／CP／Series／Brand 分類摘要；缺少時使用商品的公開分類，不捏造資料。
- 中文 Sale Type：現貨、預購、搶購、候補。
- 台北時間的結單日期與時間。
- 剩餘時間文字；過期顯示已截止，不只靠顏色表達。
- 是否可能二補。

倒數只根據權威 Campaign 時間計算，不改寫 Campaign 狀態或 Checkout 判斷。

## 7. 商品推薦 Grid

- 僅使用 `productsPublic` 的 published 商品及現有排名函式。
- 手機預設 `grid-cols-2`；1365px 桌面 `lg:grid-cols-4`；768px 維持可讀的 2 欄。
- 圖片容器固定 4:5，使用現有 `ProductCoverImage` 與 Next Image；無圖時顯示一致 fallback。
- 卡片顯示商品名稱、有效售價、Sale Type、Campaign、結單時間、二補 Badge。
- 商品描述不在緊湊卡片中佔據主要高度，完整說明留在詳情頁。
- 主操作是加入購物車，至少 44×44px；商品圖片與名稱可進詳情頁。
- Loading 使用保留 4:5 空間的 Skeleton；Empty 清楚說明目前無開放商品；Error 提供 Retry 並用 `role="alert"`。

## 8. 訪客加入購物車登入閘門

點擊首頁商品卡的加入購物車時：

1. 若已登入，沿用現有 `addCartItem` 行為與 authoritative Campaign／Variant ID。
2. 若未登入，先在瀏覽器保存一筆最小待處理意圖：`productId`、`variantId`、`saleCampaignId`、`quantity`；不保存價格、權限或私人資料。
3. 顯示 `請先使用 Google 登入` 的可及提示並呼叫既有 `signInWithGoogle()`。
4. 登入完成後，既有首次會員資料導向優先；待會員回到可購物頁時，從最新 `productsPublic` 重新驗證商品、Variant 與 Campaign，再加入購物車並清除意圖。
5. 登入失敗時保留意圖供重試；不將前端價格或狀態當成權威資料。

這只改善前台 intent continuity，不改 Checkout、Order 或 Collection。

## 9. 購買流程、二補、FAQ／客服

- 購買流程以四個簡短步驟呈現：Google 登入與會員資料、選購、銀行匯款回報、等待確認／後續通知。
- 二補區明確說明可能來源、通知方式與付款期限，不承諾固定金額。
- FAQ／客服區連到 `/brand#faq` 與正式客服入口；未設定的社群不顯示假連結。
- 不再呈現快速工具卡、會員私人頁面捷徑或 OMS 操作說明。

## 10. 視覺與可及性

沿用核定 Token：

- Page `#F7F3F2`
- Surface `#FFFFFF`
- Ink `#20242B`
- Border `#DED7D6`
- Secondary `#6C6B70`
- Brand `#6E4E64`
- Brand Soft `#E7DDDF`
- Service `#466060`
- Campaign `#F8C7CC`
- Catalog `#81A684`

設計採暖白、細邊框、10–12px 圓角、寬鬆留白及克制的 150–200ms 色彩／陰影回饋。不加入 Emoji 圖示、大量深色卡或新的 slate／amber 主視覺。

所有互動目標至少 44×44px；鍵盤順序依視覺順序；非同步訊息使用 `aria-live`／`role="alert"`；全站既有 `prefers-reduced-motion` 規則繼續生效。價格與倒數使用 tabular numbers，圖片預留比例避免 CLS。

## 11. 響應式契約

- 390px：無水平溢出；商品固定 2 欄；卡片文字與 CTA 不重疊。
- 768px：主要區塊舒適換行；Campaign 卡與商品 Grid 保持一致 gutter。
- 1365px：推薦商品固定 4 欄；內容最大寬度與 Header／Footer 對齊。
- Header、Hero CTA 與商品操作在三個尺寸皆達 44px。

## 12. 測試與驗收

先以失敗測試鎖定：

- `/` 固定 section 順序且不含技術／OMS 文案。
- Header 品牌與導覽文字正確。
- 首頁商品卡使用真實 Repository、4:5 圖片、4／2 欄 Grid。
- Campaign 顯示分類、Sale Type、結單時間、剩餘時間及二補。
- 未登入加入購物車呼叫 Google 登入並保存最小意圖；登入後重新驗證再加入。
- Loading、Empty、Error、Retry 與可及狀態存在。
- Playwright 在 390、768、1365px 無水平溢出，Grid 欄數正確。

最後執行：

```text
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e -- tests/e2e/public-home.spec.ts
```

## 13. 明確不做

- 不新增替代首頁或假商品。
- 不修改登入 Provider、Firebase Rules 或資料模型。
- 不改 Checkout、價格決策、拆單或訂單建立流程。
- 不讀 `productsInternal`。
- 不加入收藏、搜尋、輪播、促銷排行或未實作付款方式。
