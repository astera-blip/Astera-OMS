# Astera 整站 UI/UX 與銀行對帳整合設計

日期：2026-08-02  
狀態：Owner 已確認附件需求，開始分批實作

## 目標

將公開前台改為 Astera 收藏選物店體驗，將會員中心與 Owner Workspace 分層，並新增正式 `/checkout` 頁面與台新銀行交易明細匯入／對帳介面。既有 Firebase Collection、Rules、Checkout 商業邏輯與付款交易語意全部保留。

## 已確認決策

- 銀行帳戶只在付款回報時要求；沒有帳戶仍可建立訂單。
- `/checkout` 是新的 UI 路由，沿用既有 `POST /api/checkout` 與 Campaign 拆單、Consent、冪等邏輯。
- 會員最多五筆自己的匯款帳戶；完整帳號只留 Server，畫面顯示遮罩。
- 付款回報同時選會員來源帳戶與 Astera 收款目的地，可分配多張付款請求。
- 台新 Excel 對帳先以 Owner Workspace 的受保護匯入與比對工具實作；不新增 Wallet 或 ERP Collection。
- 台新檔案欄位依提供的 `main.py`：交易日、帳務日、摘要、金額、餘額、備註；備註抽取最長連續數字末五碼，金額＋末五碼作為比對鍵。

## 分層資訊架構

### 公開前台

`/`、`/products`、`/products/[id]`、`/brand`、`/terms`、`/privacy`、`/cart`、`/checkout`

Header 顯示 ASTERA Logo、商品、Campaign／品牌、FAQ／客服、購物車與登入狀態。首頁順序固定為 Hero、最新 Campaign、商品 Grid、購買流程、二補、FAQ／客服、Footer。

### 會員中心

`/account/profile`、`/account/bank-accounts`、`/orders`、`/payments`

使用服務色區分會員、銀行、付款與訂單服務；登入、個資、帳戶、付款狀態與錯誤訊息都以文字和圖示呈現。

### Owner Workspace

`/workspace` 及其商品、會員、訂單、付款、內容、稽核頁。維持高資訊密度，但不使用公開前台 Hero；所有高風險操作仍由 Owner custom claim API 執行。

## 視覺 Token

沿用 `docs/superpowers/specs/2026-08-02-astera-final-visual-system-design.md` 的 Token：Page `#F7F3F2`、Surface `#FFFFFF`、Ink `#20242B`、Border `#DED7D6`、Secondary `#6C6B70`、Brand `#6E4E64`、Service `#466060`、Campaign `#F8C7CC`、Catalog `#81A684`。公開前台不可出現 MVP、Firestore、Owner、Audit Log 等技術文案。

## 對帳資料流程

1. Owner 在 Workspace 選擇台新 `.xlsx`。
2. Server 驗證檔案型別、欄位與資料列，不把檔案或完整銀行資料送到前台。
3. Server 解析交易日期、摘要、金額、備註末五碼，建立暫存匯入結果與比對鍵。
4. Owner 選擇待確認付款，系統以匯款金額＋會員回報末五碼比對交易。
5. 匯入／比對結果保存安全化摘要、操作者與時間；不覆寫 Payment、PaymentAllocation 或 Audit Log 歷史。

## 驗收

- 390px、768px、1365px 無水平溢出，商品 Grid 為 2／3／4 欄。
- 訪客瀏覽可用，加入購物車觸發登入閘門；登入後未完成個資導向 Profile。
- Checkout 路由可建立既有拆單訂單，無銀行帳戶仍可建立訂單。
- 付款回報要求兩種有效帳戶並支援多筆付款請求。
- Owner 可匯入提供格式的台新明細，正確產生末五碼與金額比對結果。
- Unit、API、Rules、TypeScript、ESLint、Build、Playwright 全部通過。
