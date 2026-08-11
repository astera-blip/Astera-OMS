# Astera OMS MVP Product Requirements Document

> **版本：** v1.0  
> **日期：** 2026-07-30  
> **產品：** Astera OMS  
> **產品階段：** MVP／小圈測試與正式上線準備  
> **完整技術交接：** `docs/20_CompleteAIHandoff_2026-07-30.md`

## 1. 產品摘要

Astera OMS 是面向台灣消費者的泰國 GL／藝人周邊代購平台與訂單管理系統。它讓會員可以瀏覽公開商品、依活動下單、以銀行匯款付款並追蹤訂單；Owner 可管理商品、販售活動、付款、取消、會員風險與品牌內容。

Astera 的體驗重點不是大量促銷，而是讓會員清楚知道：可買什麼、何時結單、是否需要付款／二補，以及訂單目前進度。

## 2. 問題與機會

泰國藝人周邊代購常以表單、訊息與人工對帳管理，容易出現：

- 商品、規格與活動名稱不一致。
- 結單時間不清楚。
- 不同活動訂單與付款難以對應。
- 匯款回報、人工確認與取消退款缺乏可追溯紀錄。
- 商品成本、內部備註或會員資料可能被不當暴露。

Astera MVP 用受保護的商品、Checkout、付款、取消與 Audit Log 流程，先解決小圈測試所需的交易可見性、操作一致性與資料安全。

## 3. 目標、非目標與成功定義

### 3.1 MVP 目標

1. 會員可透過 Google 登入、補齊會員資料、瀏覽商品並下單。
2. 系統依 Campaign 自動拆單，保留下單時的價格與商品 snapshot。
3. 所有價格、活動時間、權限與訂單狀態由 Server 驗證。
4. 會員能回報銀行匯款；Owner 能確認、撤銷與追蹤金額差異。
5. 未付款可直接取消；已付款取消有人工退款資訊與不可修改稽核紀錄。
6. Owner 可不靠工程人員管理商品、規格、販售活動、分類與品牌內容。
7. 前台只暴露公開商品資料，私有成本、內部備註、SKU 與會員私密資料不得外洩。

### 3.2 非目標

本 MVP 不做：

- Helper 高風險寫入權限。
- Warehouse、進貨、庫存 ERP。
- CRM、VIP、標籤、朋友、完整客戶時間軸。
- Finance、Wallet、儲值、線上刷卡或自動退款。
- Analytics、推薦演算法、假人氣、假優惠。
- 搜尋、收藏、候補 Dashboard 的完整產品化。
- 海外配送或其他未明確支援的服務承諾。

### 3.3 成功定義

MVP 可上線的最低成功條件：

- 會員可成功完成 Google 登入、Profile、商品瀏覽、Cart、Checkout、付款回報與訂單查看。
- Owner 可成功建立／封存商品、Variant、Campaign，公開商品投影正確。
- Checkout 依 Campaign 拆單、產生正式訂單號、保存 ConsentRecord。
- 未付款取消與已付款退款審核皆可留存 Audit Log。
- 正式匿名前台可讀已刊登 `productsPublic`，私有資料與 Client business writes 被拒絕。
- CI、Rules、Playwright、Production smoke、手機驗收與實際寄信驗證完成。

## 4. 使用者與角色

| 角色 | 主要需求 | MVP 權限 |
| --- | --- | --- |
| 訪客 | 看公開商品、品牌資訊與服務規則 | 只讀已刊登 `productsPublic` 與公開內容 |
| Member | 登入、下單、付款回報、查看自己的訂單、申請取消 | 只讀自己的會員／購物車／訂單／付款／取消資料；透過 API 提交意圖 |
| Owner | 經營商品、付款、取消、會員風險、內容與稽核 | Firebase custom claim `role: owner`；受保護 API 管理 |
| Helper | 未來協助低風險工作 | 維持低權限；不得新增付款、退款、稽核或私密資料高風險寫入 |

Owner 判斷不可依 Email，唯一正式來源是 Firebase custom claim。

## 5. 核心使用流程

### 5.1 會員購買流程

1. 會員以 Google 登入。
2. 第一次登入補齊會員資料。
3. 在商品列表或商品詳情查看公開說明、活動、價格、結單資訊與二補提醒。
4. 選擇 Variant 與數量加入購物車。
5. 購物車可含不同 Campaign／sale type。
6. Checkout 填寫收件資料，勾選服務條款／隱私權及二補規則。
7. Server 重新驗證商品、Variant、Campaign、時間、價格、會員狀態與同意內容。
8. 系統依 Campaign 拆成多張 Order，建立對應 PaymentRequest、ConsentRecord、NotificationEvent。
9. 會員依銀行匯款資訊付款並回報付款資料。
10. Owner 確認後，會員在訂單與付款頁看到狀態更新。

### 5.2 取消流程

1. 會員從訂單詳情選擇要取消的 OrderItem。
2. 未付款項目由 Server 直接取消，並重算 Order 與 PaymentRequest 金額／狀態。
3. 已付款項目建立待審取消申請。
4. Owner 核准已付款取消時，必填退款日期、退款金額、退款參考資訊。
5. 系統追加負向 adjustment 與 Audit Log；不可覆寫歷史付款或取消資料。

### 5.3 Owner 商品上架流程

1. Owner 在 Products 建立 Product；系統自動派發 Product ID、Product SKU 與 Default Variant。
2. Owner 填寫公開名稱、說明、分類、內部備註、Variant、成本與售價。
3. Owner 建立一或多個 Campaign，設定 sale type、價格、時間、二補規則與狀態。
4. Server 在同一交易／批次更新私有主檔及 `productsPublic` projection。
5. 前台只顯示公開欄位；SKU、成本、內部備註不顯示。
6. 不再販售時 Owner 封存 Product 或 Campaign，不硬刪歷史資料。

## 6. 功能需求

### 6.1 Authentication 與會員資料

- 僅支援 Google 登入。
- Profile 姓名拆為「姓」與「名」。
- 有效資料儲存成功後導回首頁。
- 生日為選填，空白不得造成 Profile 儲存失敗。
- 會員不可讀取其他會員資料或 Owner 內部備註。
- Owner 可設定風險狀態：`Normal（正常）`、`Watch（注意）`、`Blacklisted（黑名單）`。
- Blacklisted Member 不可 Checkout；風險變更要留下 Audit Log。

### 6.2 商品、Variant、Campaign 與分類

#### Product

- Product 欄位：系統識別碼、SKU、名稱、公開說明、內部備註、分類、圖片、刊登狀態。
- 狀態：`Draft（草稿）`、`Published（已刊登）`、`Archived（已封存）`。
- Product ID 與 SKU 由系統派發、正常 UI 不可修改、提供複製按鈕。
- Internal Note 僅供後台；公開頁不得顯示。

#### Variant

- Variant 欄位：系統派發 SKU、規格名稱、原幣成本、原幣別、預設售價、Default Variant。
- 原幣別預設 `THB（泰銖）`，可選 TWD、JPY、KRW、USD。
- Variant Name 現階段為自由輸入。
- 已封存 Variant 不重用 SKU 序號。

#### Campaign

- Campaign 欄位：活動名稱、sale type、status、salePriceTwd、開始／結束時間、公開提醒、二補說明。
- Sale Type：`In Stock（現貨）`、`Preorder（預購）`、`Rush Purchase（代搶）`、`Waitlist（候補）`。
- 狀態：`Upcoming（即將開始）`、`Open（開放中）`、`Closed（已結束）`、`Archived（已封存）`。
- 有效 Campaign 價格優先於 Variant Default Price。
- Archived 不得出現在前台投影。

#### Classification Master

- 管理 Company、Artist、CP、Brand、Series。
- ProductWorkspace 提供 `Products（商品管理）` 與 `Classifications（分類管理）` 分頁。
- 分類 ID 由 Server 建立；使用者輸入顯示名稱。
- 分類可改名與封存，不得硬刪。
- 必須拒絕空白與重複名稱。

### 6.3 商品圖片

- 最多八張圖片。
- 接受 JPEG、PNG、WebP；單檔最大 5 MB。
- 第一張為 cover，可排序，需填 alt text。
- 儲存路徑位於公開商品圖片 namespace，檔名使用隨機 ID。
- Owner 才可上傳；公開只讀；其餘路徑拒絕。
- 移除圖片只解除 Product reference，不直接刪 Storage object。
- `productsPublic` 保存排序後公開圖片資料。
- 商品列表、首頁、詳情需有 responsive image、尺寸與無圖 fallback。

### 6.4 購物車與 Checkout

- Cart 可加入不同商品、sale type、Campaign。
- 0 件商品時「建立訂單」必須 disabled。
- Checkout 不接受 Client 價格或 Campaign 狀態。
- 必填收件資料與配送方式。
- 必須勾選條款／隱私及二補同意。
- 每個 Campaign 產生一筆 Order、PaymentRequest、ConsentRecord，並共用 checkoutGroupId。
- 回傳所有 orderId、orderNumber、Campaign 與應付金額。
- Member 頁面優先顯示 orderNumber。

### 6.5 付款

- 會員付款回報欄位：PaymentRequest、匯款日期、金額、帳號末五碼、匯款人、備註。
- Payment 初始為 `pendingReview`。
- Owner 依 Payment ID 確認。
- 付款結果：`partiallyPaid`、`paid` 或額外 `unallocatedAmountTwd`。
- 超額不建立 Wallet；由營運人工銀行退款處理。
- Owner 可撤銷已確認 Payment；必須保留原紀錄、追加負向 adjustment 與 Audit Log。

### 6.6 取消

- 最小單位是 OrderItem。
- 未付款：直接取消，重算總額與 PaymentRequest，不需 Owner 審核。
- 已付款：建立 CancellationRequest；Owner 核准必須填退款 metadata。
- 混合選取：Server 對未付款直接取消，對已付款建立審核申請。
- Audit Log 與 adjustment 不可修改。

### 6.7 品牌內容、法律與通知

- Owner 可管理品牌介紹、FAQ、公告、社群連結與 Footer。
- 未設定的 LINE／Instagram／客服資訊不可產生假連結或「暫不提供」低信任內容。
- `/terms`、`/privacy` 需公開可讀，顯示版本與生效日期。
- ConsentRecord 保存接受的正式版本 ID、二補同意與時間。
- 訂單成立與付款確認先完成業務交易，再嘗試寄 Resend email。
- Email 失敗不可回滾業務交易。
- NotificationEvent 保存 `pending | sent | failed`、provider ID、重試次數與安全化錯誤；Owner 可 retry。

## 7. 前台與後台 UX 需求

### 前台

- 風格：溫暖灰米白、低飽和、收藏選物感、留白清楚。
- 不顯示 Firestore、custom claim、MVP phase、snapshot、Owner 後台等技術文案。
- 不顯示假促銷、無根據推薦、假熱門排行、未支援支付方式。
- 商品卡、商品詳情、Cart、Campaign 必須清楚顯示結單資訊與是否可下單。
- 商品空狀態使用消費者語言，需有 retry。
- Footer 只顯示可執行的客服／社群資訊。

### 後台

- 以資訊密度、搜尋、篩選、狀態、Audit Log 與操作效率為主。
- 所有異步操作需 disabled 防重複送出、顯示處理中、以 aria-live 或 alert 宣告結果。
- 所有主要控制項應具 keyboard focus-visible、至少 44px 觸控目標。
- 提供 Products、Classifications、Members、Orders、Payments、Content、Audit Logs 導覽。

## 8. 非功能需求

### 安全與隱私

- Firestore / Storage Rules deny-by-default。
- Client business writes 拒絕，使用受保護 API / Admin SDK。
- Private Product、成本、內部備註、付款、Audit Log、會員私密資料不得公開。
- 所有 Owner API 驗證 custom claim。
- 無長期服務帳號私鑰；使用 Vercel OIDC / GCP WIF。

### 可及性與 RWD

- Keyboard focus、Skip Link、route focus、ARIA live / alert。
- `prefers-reduced-motion`。
- 手機使用 `min-h-dvh`，避免 iOS address-bar 視窗高度問題。
- Pixel 7、桌機與實機手機須驗收表單、navigation、datetime、select、textarea、loading／empty／error。

### 品質

- 每次程式修改至少執行 TypeScript、ESLint、相關 Unit；受影響時執行 Rules／Playwright／Build。
- 上線前執行完整 Unit、Rules、regular Playwright、emulated Playwright、secret scan、production audit 與 production smoke。

## 9. 指標

MVP 初期以流程正確與營運可追溯為主，不做 Analytics 平台。手動／Audit 追蹤：

- Checkout 成功率與重複建立事件數。
- Payment pendingReview 到 Owner confirm 的處理時間。
- 部分付款／超額付款件數。
- 直接取消與待審取消比例。
- Notification sent / failed / retry 成功率。
- 商品投影錯誤、Rules 拒絕、登入失敗與表單失敗事件。

## 10. 已完成驗證與目前狀態

2026-07-30 Preview 已完成真實且可回復的流程驗證：

1. Owner 建立 TEST-ONLY Product、Variant、Open Campaign，系統派發 SKU。
2. 前台公開投影顯示 NT$1 商品，未暴露私有資料。
3. Cart reload 後資料保留。
4. 只建立一筆正式訂單 `AST-20260730-0001`。
5. Order、Item、PaymentRequest 初始皆為待付款／NT$1。
6. 未付款直接取消後，三者皆為已取消／NT$0。
7. Product / Campaign 封存後從公開 `/products` 消失。

最近通過：Unit 26 files / 133 tests、TypeScript、ESLint、production build、Preview Browser lifecycle。

## 11. 尚未完成與上線依賴

### 可由工程繼續處理

- Campaign `datetime-local` 開始／結束時間的儲存與回讀驗證／修正。
- 非 Owner、Helper、跨會員權限驗證。
- 完整 Payment Report / confirm / reverse / paid cancellation / refund 的實機流程驗收。
- 多 Variant／多 Campaign 的人工 UI、拆單、封存與價格優先驗收。
- 完整桌機、Pixel 7、實機手機驗收。

### 外部依賴

- Firebase Blaze 與 dev/prod `asia-east1` Storage buckets。
- Production Firestore / Storage Rules deploy。
- Production product backup、projection audit、Owner API re-save/sync。
- `updates.asteratw.com` Resend SPF/DKIM 與 production API key。
- `asteratw.com` 購買、Vercel canonical、www redirect、Firebase Authorized Domains。
- 法律／營運最終 Terms、Privacy、客服、付款、二補、取消、配送內容。
- Production Google login、實際信件、手機與商品圖片上線驗收。

## 12. 發布條件

Production release 必須依序完成：

1. 所有程式與 migration dry-run 完成。
2. Vercel OIDC / Admin API verified。
3. Firestore / Storage Rules 先 dev 後 production 部署並驗證。
4. 備份、Product projection audit、正式商品同步與正式內容發布。
5. Vercel / Firebase domain、環境變數、Authorized Domains 設定。
6. Resend 實際測試信送達。
7. Production desktop、Pixel 7、實機手機驗收。
8. CI 全綠、Production smoke 正常、交接／SOP／Changelog／Decision Log 更新。

## 13. 參考文件

- `docs/20_CompleteAIHandoff_2026-07-30.md`：完整技術與進度交接。
- `docs/19_Astera_UIUX_Design_Handoff_v1.1.md`：UI/UX 完整方向。
- `docs/16_MVPCompletionPlan.md`：執行批次與驗證歷程。
- `docs/17_ProjectHandoff.md`：技術修正與外部設定證據。
- `docs/10_TestPlan.md`：測試計畫。
- `docs/14_Deployment.md`：部署、OIDC 與環境設定。
- `docs/SOP/正式資料備份與商品同步SOP.md`：Production backup / sync / rollback。
