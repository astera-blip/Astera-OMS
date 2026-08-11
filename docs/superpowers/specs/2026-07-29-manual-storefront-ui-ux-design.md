# 手動測試前台 UI/UX 修正設計

## 目標

修正手動測試中會阻礙買家理解或下單的前台 UI/UX 問題，同時維持既有 Next.js、Firebase 與資料模型。

## 已確認範圍

1. 商品頁必須明確區分載入中、讀取失敗、沒有商品與篩選後無結果；讀取失敗可直接重新載入。
2. 空購物車不可送出訂單，應清楚引導至商品列表；結帳欄位保有穩定的 `id`、`name` 與適合瀏覽器自動填寫的 `autocomplete`。
3. 品牌頁與 Footer 不顯示未啟用社群的假入口或「Instagram：暫不提供」；沒有社群時改提供可執行的客服／訂單協助說明。
4. 首頁、商品與購物車只使用買家看得懂的中文，不顯示 MVP、Firestore、custom claim、Owner、Demo、Phase、snapshot、qty 或其他內部術語。
5. 所有此批次新改動維持鍵盤焦點、`aria-live`、44px 觸控目標與手機版不水平溢出。

## 方案比較

### 方案 A：只改文案

風險最低，但不能解決錯誤狀態沒有重試、空狀態與載入混淆及不可用 CTA 的問題。

### 方案 B：局部狀態與語意修正（採用）

在既有 storefront components 中補齊明確狀態、重試操作、表單語意與買家文案；不改 API、Collection 或 checkout 計算。可直接以 Unit／Playwright 驗證。

### 方案 C：重做前台頁面架構

視覺彈性最大，但會擴大範圍並提高回歸風險，不符合 MVP 與「不重新設計架構」原則。

## 元件與資料流

- `PublicProductsBoard` 和 `FeaturedProductsBoard` 仍從 `productsPublic` 載入商品，只在 Client state 中區分 `loading`、`ready`、`empty`、`error`，並在 error 提供重新載入。
- `CartBoard` 仍由受保護 `/api/cart` 與 `/api/checkout` 處理資料，前端僅改善空購物車、表單語意、提交回饋與錯誤呈現。
- `BrandPage`、`StorefrontFooter` 只渲染 active 且有 URL 的社群資料；未設定社群時不產生假連結或未開放社群卡片。
- 共用 accessibility 規則延續 root layout 的 skip link、路由焦點與全域 `:focus-visible`；新增的動態訊息以 `aria-live` 宣告。

## 錯誤處理與驗收

- 商品讀取失敗時不把錯誤偽裝成零筆資料，且提供「重新載入」。
- 無商品與篩選無結果採不同買家文案。
- 空購物車的訂單 CTA 使用原生 `disabled`，不送出請求。
- `/`、`/products`、`/brand`、`/cart` 不應顯示內部術語；`/brand` 的內容讀取失敗使用安全 fallback，不應 500。
- Playwright 覆蓋上述公開路由、空購物車禁用與表單欄位語意；單元測試覆蓋可抽離的買家文案／狀態 helper。
