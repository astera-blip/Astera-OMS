# Astera OMS 完整產品需求與 UI／UX 規格

> 版本：v1.0  
> 日期：2026-08-02  
> 文件狀態：Owner 已確認核心需求；視覺規格已確認採用；外部服務與法律內容仍需上線前確認  
> 適用產品：Astera OMS MVP／封閉測試與正式上線準備

## 1. 文件定位與權威順序

本文件整合 Astera 交接資料、MVP PRD、完整產品需求、UI／UX 交接與 2026-08-02 最終視覺系統決策，作為後續工程、測試、設計與 AI 交接的單一摘要。

需求衝突時依下列順序處理：

1. Owner 最新明確確認的決策。
2. 本文件的「已確認」規則。
3. `docs/22_Astera_OMS_Complete_Product_Requirements.md` 未被覆蓋的內容。
4. `docs/20_CompleteAIHandoff_2026-07-30.md` 的程式真實狀態。
5. 舊建議、示例與尚未確認的內容不得自行升級成產品功能。

新版視覺系統取代舊版 Stone Grey 的色彩 Token；資料模型、Collection、API 業務規則、Campaign 規則、付款規則與權限原則仍沿用既有規格，除非本文件明確修改。

## 2. 產品定位

Astera OMS 是面向台灣消費者的泰國 GL、藝人與收藏周邊代購平台及營運訂單系統。

核心體驗是讓會員清楚知道：

- 可以購買什麼商品與規格。
- 哪一個 Campaign 正在開放、何時結單。
- 商品是否為現貨、預購、代搶或候補。
- 應付多少款項、付款是否待確認、是否可能二補。
- 訂單、付款、取消及退款目前進度。

產品第一階段是 MVP／小圈測試，不是 ERP。

## 3. MVP 範圍

### 3.1 首次上線必須支援

- Google 登入與會員資料。
- 公開商品瀏覽與商品詳情。
- Product、Variant、Campaign 與 Classification Master 管理。
- Product SKU、Variant SKU 系統自動派發。
- 公開商品 projection：`productsInternal` → `productsPublic`。
- 商品圖片上傳、排序、封面、alt text 與 Storage 權限。
- 購物車與不同 Campaign 混合結帳。
- Campaign 拆單、正式 `orderNumber` 與 `checkoutGroupId`。
- 條款／隱私／二補 ConsentRecord。
- 銀行匯款付款回報、Owner 確認、部分／足額／超額付款。
- `unallocatedAmountTwd`、Payment reverse、負向 adjustment 與 Audit Log。
- OrderItem 未付款直接取消。
- 已付款取消申請、Owner 審核與退款 metadata。
- 品牌內容、FAQ、公告、Footer、Terms、Privacy。
- Resend 訂單／付款通知事件與 Owner retry。
- Firestore／Storage Rules、API 權限、Unit、Rules、Playwright 與手機驗收。

### 3.2 明確不納入首次 MVP

- Warehouse、採購、到貨、配貨、Shipment。
- CRM、VIP、朋友、標籤、完整會員時間軸。
- Finance、Wallet、信用額度、儲值、分潤與自動退款。
- Analytics、假熱門、假優惠、推薦演算法。
- 信用卡、Stripe、LINE Pay、超商代碼、海外付款。
- Partner 完整權限模型。
- 搶購結果分配、候補名額分配與庫存鎖定的完整營運模組。
- 會員 Dashboard 的完整待辦產品化；本輪只建立視覺骨架，不新增待辦、通知與完整業務功能。

## 4. 使用者與權限

| 角色 | 需求 | 權限原則 |
| --- | --- | --- |
| 訪客 | 查看公開商品與公開內容 | 只讀已刊登 `productsPublic` 與公開內容；不可結帳 |
| Member | 登入、補資料、購買、付款回報、查看自己的訂單、取消 | 只能讀自己的會員、購物車、Order、Payment、Cancellation；業務寫入走 API |
| Owner | 管理商品、Campaign、分類、會員、付款、取消、內容、稽核 | Firebase custom claim `role: owner`；受保護 API／Admin SDK |
| Helper | 未來協助低風險營運工作 | 不得付款確認、退款、reverse、Audit、Private Note 或高風險寫入 |

Owner 判斷唯一依據為 Firebase Custom Claim，不得依 Email 判斷。

跨會員的 Order、Payment、Cancellation、Member Private Note 與會員資料，讀取及寫入都必須拒絕。

## 5. Authentication 與會員資料

- 只支援 Google 登入。
- 首次登入必須補齊：姓、名、社群內 ID、台灣手機號碼。
- 生日為選填，空白不得造成儲存失敗。
- 成功儲存 Profile 後回到首頁。
- 手機號碼正規化後儲存及比對。
- 重複手機號碼顯示「疑似重複會員」警示，但不阻止註冊。
- Risk State：`Normal（正常）`、`Watch（注意）`、`Blacklisted（黑名單）`。
- Blacklisted Member 不得 Checkout。
- Risk State 變更必須建立 Audit Log。
- Member 不得讀取內部備註；Owner 才可查看及修改。

## 6. Product、Variant、Campaign 與分類

### 6.1 Product

- Product ID 由 Server 建立，正常 UI 唯讀，提供複製按鈕。
- Product SKU 格式：`AST-P000001`，由 `siteSettings/system-sequences` 原子派發。
- Product SKU 建立後不可由一般 UI 修改。
- 欄位包含公開名稱、公開說明、Internal Note、分類、圖片、Publish State。
- Publish State：`Draft（草稿）`、`Published（已刊登）`、`Archived（已封存）`。
- Internal Note 只供後台記錄採購來源、限購、成本、交接事項等，不得出現在公開 projection。
- 封存採軟刪除，不硬刪歷史資料。

### 6.2 Variant

- Variant SKU 格式：`AST-P000001-V001`，由 Server 自動派發。
- SKU 正常 UI 唯讀，提供複製按鈕。
- Variant 被封存後不補用舊號；V001、V002、V003 封存 V002 後，下一個為 V004。
- 已被 OrderItem 引用的 SKU 永不改寫；歷史 Order snapshot 保留原值。
- 欄位包含規格名稱、Default Variant、原幣成本、原幣別、Variant Default Price。
- 原幣別預設 `THB（泰銖）`，可選 `TWD（新台幣）`、`JPY（日圓）`、`KRW（韓元）`、`USD（美元）`。
- Variant Name 目前維持自由輸入；未來下拉選單需另行確認，不在本文件自行改動。

### 6.3 Campaign

- Campaign 代表一次實際販售活動，不是廣告投放。
- 欄位包含活動名稱、Sale Type、Campaign Status、Sale Price、開始／結束時間、公開提醒、二補說明。
- Campaign 活動時間由 `datetime-local` 輸入，統一以台北時間 UTC+8 解讀；Server 儲存標準 UTC ISO 值；回讀時轉回台北時間輸入格式。
- Server 必須驗證開始時間早於結束時間、日期格式有效、狀態與時間一致。
- Status：`Upcoming（即將開始）`、`Open（開放中）`、`Closed（已結束）`、`Archived（已封存）`。
- 尚未到開始時間為 Upcoming；活動期間為 Open；超過結束時間為 Closed；Owner 封存為 Archived。
- Archived Campaign 不得進入 `productsPublic` 可購買 projection。
- 有效 Campaign `salePriceTwd` 優先於 Variant Default Price；沒有活動價才使用 Variant Default Price。
- Campaign 同一活動價格套用該商品所有 Variant。

### 6.4 Sale Type

正式 Sale Type：

- `In Stock（現貨）`：已有可販售現貨。
- `Preorder（預購）`：一般預購，依 Campaign 結單及付款規則處理。
- `Rush Purchase（代搶）`：目前保留既有 MVP 行為；完整搶購結果分配屬後續模組。
- `Waitlist（候補）`：目前保留既有 MVP 行為；完整候補分配屬後續模組。

`Member Preorder（會員預購）` 暫不納入本版本，不新增 Sale Type、權限流程或前台購買邏輯。

新增 Sale Type 不得由前端自行繞過；Checkout Server 必須重新驗證登入身分與 Campaign。

### 6.5 Classification Master

- 管理 Company、Artist、CP、Brand、Series。
- ProductWorkspace 提供 `Products（商品管理）` 與 `Classifications（分類管理）` 分頁。
- 分類 ID 由 Server 建立；使用者只輸入顯示名稱。
- 名稱不可空白、不可重複。
- 支援修改顯示名稱與封存，不提供硬刪除。
- 狀態：`Active（啟用）`、`Archived（已封存）`。
- 商品可關聯分類；名稱變更不得回寫歷史訂單 snapshot。

## 7. 商品圖片與 Firebase Storage

- 每項商品最多 8 張圖片。
- 接受 JPEG、PNG、WebP；單檔最大 5 MB。
- 第一張為封面，可排序並填 alt text。
- Object path 必須位於該 Product 的公開圖片 namespace，檔名使用隨機 ID。
- Owner custom claim 才能上傳；匿名與 Member 不得寫入。
- 公開只能讀取公開圖片，其他 Storage path 全部拒絕。
- Product API 只接受屬於該商品的 object path，Server 驗證 metadata。
- 移除圖片只解除 Product reference，不直接刪除 Storage object。
- `productsPublic` 只保存排序後的公開圖片資訊。
- 商品列表、首頁、詳情使用 responsive image、固定尺寸及無圖 fallback。

## 8. Cart、Checkout 與訂單

- Cart 可混合不同商品、Sale Type 與 Campaign。
- 0 件商品時「建立訂單」必須 disabled，並顯示請先加入商品。
- 前端只能提交商品／Variant／Campaign 意圖；不得提交可信價格、狀態或訂單結果。
- Server Checkout 重新讀取 `productsPublic`、Variant、Campaign、時間、價格、會員風險與權限。
- 必須同意服務條款／隱私權及二補規則。
- 每個 Campaign 建立一張 Order、PaymentRequest、ConsentRecord。
- 所有拆分訂單共用 `checkoutGroupId`。
- Order Number 格式：`AST-YYYYMMDD-0001`；Firestore Document ID 只作內部識別。
- 回傳全部 `orderId`、`orderNumber`、Campaign 與應付金額。
- Member 訂單頁優先顯示 `orderNumber`。
- ConsentRecord 保存正式條款版本、隱私版本、二補同意及接受時間。
- Checkout 必須具備 idempotency；重複請求不得建立重複訂單。

## 9. 付款

- 付款方式只支援銀行匯款；不得顯示尚未支援的信用卡、電子支付或其他付款方式。
- Member Payment Report 欄位：PaymentRequest、匯款日期、金額、帳號末五碼、匯款人、備註。
- 新付款初始為 `pendingReview`。
- Owner 依 Payment ID 確認，不可自行重填會員回報資料取代原始紀錄。
- 多次付款累計：不足為 `partiallyPaid`，足額為 `paid`。
- 超額金額保存為 `unallocatedAmountTwd`，不建立 Wallet；由營運人工銀行退款。
- MVP 新增「Astera 收款銀行帳戶認列」：Owner 可建立、啟用、停用正式收款帳戶；會員付款頁只顯示已認列且啟用的帳戶，Payment Report 必須選擇有效帳戶。完整帳號不得公開，歷史付款保留原帳戶快照。
- Payment reverse：原 Payment 標記 `reversed`，追加 `paymentAllocations` 負向 `kind: adjustment` 記錄，重算 PaymentRequest、Order、OrderItem。
- Payment、Allocation、Adjustment 與 Audit Log 不可覆寫或刪除歷史。
- 訂單／付款交易完成後才嘗試寄通知；Email 失敗不得回滾付款或訂單。

## 10. 取消與退款

- 最小取消單位為 OrderItem。
- 未付款項目可直接取消，不需 Owner 審核；Server 重算 Order 與 PaymentRequest。
- 已付款項目建立 CancellationRequest。
- Owner 核准已付款取消時，必填退款日期、退款金額、退款方式／參考資訊。
- 系統建立退款 metadata、負向 adjustment 與不可修改 Audit Log。
- 混合選取時，未付款項目直接取消，已付款項目建立審核申請。
- 任何取消、退款、Adjustment 只能追加歷史，不得覆寫原 Payment 或 Order snapshot。

## 11. 品牌內容、法律與通知

- Owner 可管理品牌介紹、FAQ、公告、Footer、客服與社群連結。
- 未設定的 LINE／Instagram／客服不可產生假連結或低信任的「暫不提供」區塊；只顯示可執行資訊。
- `/terms`、`/privacy` 顯示版本編號、生效日期與正式內容。
- Checkout ConsentRecord 必須保存正式版本 ID。
- Terms、Privacy、付款、二補、取消退款與配送內容公開前須經營運方或法律專業人員確認。
- Resend 寄件者：`Astera <orders@updates.asteratw.com>`；Reply-To 使用現有客服信箱。
- `notificationEvents` 保存 `pending | sent | failed`、provider ID、嘗試次數與安全化錯誤；Owner 可 retry。

## 12. UI／UX 視覺系統

新版視覺規格正式取代舊版色彩規格，適用前台、會員、付款、訂單與後台。

### 12.1 設計語氣

- Calm：安靜、低干擾。
- Refined：留白、細緻邊界、克制品牌色。
- Collection-oriented：商品與藝人企劃為主角。
- Approachable：以低彩度粉紅及綠色提供溫度。
- Trustworthy：付款、銀行帳戶、訂單狀態清楚，不依賴顏色猜測。

避免大面積高飽和色、假促銷、假熱門、無依據推薦、未支援付款、假客服承諾及沒有操作意義的裝飾按鈕。

### 12.2 Design Tokens

| Token | 值 | 用途 |
| --- | --- | --- |
| `color.page` | `#F7F3F2` | 頁面底色 |
| `color.surface` | `#FFFFFF` | 卡片、表面、輸入區 |
| `color.ink` | `#20242B` | 主文字、導覽、結構線 |
| `color.border` | `#DED7D6` | 邊框與分隔線 |
| `color.textSecondary` | `#6C6B70` | 次要文字 |
| `color.brand` | `#6E4E64` | Astera 主色、主要 CTA、選取狀態 |
| `color.brandSoft` | `#E7DDDF` | 柔和背景、選取膠囊 |
| `color.service` | `#466060` | 會員、付款、銀行與服務資訊 |
| `color.campaign` | `#F8C7CC` | GL／藝人企劃及活動提示 |
| `color.catalog` | `#81A684` | 商品分類、預購及低優先 Badge |

`#0E0F19` 只作深色浮層或遮罩；`#57886C` 只作輕微 hover／輔助邊框。舊品牌色 `#9A6F5E` 不再作主色。

### 12.3 色彩語意

- 主要 CTA：`#6E4E64`；hover、focus、pressed 可轉深色，但完成狀態不能只靠顏色。
- 會員／付款服務：`#466060`。
- Campaign／GL 活動：`#F8C7CC`，不可表示錯誤或付款失敗。
- 商品分類／低優先 Badge：`#81A684`，文字使用深色，不使用低對比白字。
- Success、Error、Warning 使用獨立語意色並搭配文字／圖示。

### 12.4 元件與版面

- 頁面使用 `color.page`；卡片使用白色與細邊框，不使用厚重陰影。
- 大區塊卡片 12px；商品／Campaign 卡片 10px；圖片 8px；Button 8px；Badge／Filter chip 使用膠囊或 6px。
- ASTERA Logo 可使用襯線字體；正文、表單與後台使用清晰無襯線字體；中文閱讀優先。
- 金額、數量、倒數使用 tabular numbers。
- 未登入首頁是收藏選物店，不是促銷 Landing Page。
- 首頁、列表、詳情、Cart 不顯示 Firestore、custom claim、MVP phase、snapshot、Owner 後台等技術文案。
- 商品卡主要層級為圖片、名稱、價格、Campaign 與結單資訊。
- 商品列表手機一排 2 個；圖片固定 4:5 並預留尺寸。
- 會員／付款頁以服務資訊清楚為主，不顯示未支援付款方式。
- 後台維持高資訊密度，但與前台共用同一組 Token；不使用大面積 Pink／Sage。
- 本輪建立 Member Dashboard 視覺骨架：桌面左欄任務／右欄商品、手機預覽橫向滑動；只提供版面、Loading、Empty、Error 與 Retry 狀態，不新增完整待辦、通知、候補或二補業務功能。

### 12.5 銀行帳戶認列 UI

- Owner 後台可新增、編輯、啟用與停用 Astera 收款銀行帳戶。
- 顯示銀行名稱、分行、戶名、帳號末五碼與帳戶狀態；完整帳號只供受保護後台使用。
- 會員付款頁只顯示已認列且啟用的收款帳戶。
- Payment Report 必須選擇有效收款帳戶；Server 重新驗證帳戶狀態。
- 停用帳戶不得接受新的付款回報，但歷史付款不得被刪除或改寫。

### 12.6 可及性與互動

- 所有控制項有 keyboard `focus-visible`。
- 提供 Skip Link 與路由後主要內容焦點定位。
- 非同步操作期間 disabled，顯示「儲存中／建立中／處理中」。
- 一般狀態使用 `aria-live="polite"`；錯誤使用 `role="alert"`。
- Icon-only 操作必須有 `aria-label`。
- 觸控目標至少 44×44px，相鄰操作至少 8px。
- Button、Chip、Card hover 150–200ms；支援 `prefers-reduced-motion`。
- 狀態同時提供文字、圖示／前綴與顏色，不能只靠顏色。
- 所有頁面具備 Loading、Empty、Error、Retry、權限不足與已截止狀態。
- 主要文字與 CTA 通過 WCAG AA 對比檢查。

## 13. Server 信任邊界與資料模型

- `productsInternal` 是商品私有主檔；`productsPublic` 是前台唯一商品來源。
- Client SDK 不得直接寫入會員、購物車、商品、分類、品牌內容、Order、Payment、Cancellation、Audit 等業務資料。
- 受保護 API 使用 Firebase ID token；Owner 使用 custom claim；Server 以 Admin SDK 讀寫。
- Firestore Rules deny-by-default：訪客只讀公開 projection；Member 只讀自己的資料；Owner 可讀後台資料；業務寫入由 Client 全部拒絕。
- Helper 維持低權限，不可高風險付款／退款／稽核／私密資料寫入。
- Production 不保存長期服務帳號私鑰；Vercel OIDC／GCP Workload Identity 為正式身分路線。
- Development、Emulator、Preview、Production 必須分離。

## 14. 公開 API 需求摘要

- `POST /api/checkout`：接收 Cart、收件資料、兩項 Consent、idempotencyKey；Server 回傳所有拆分 Order。
- `GET/PUT /api/cart`：會員購物車受保護 API。
- `GET/POST /api/workspace/products`：Owner 商品、Variant、Campaign 建立與重新生成 projection。
- `GET/POST/PATCH /api/workspace/classifications`：Owner 分類主檔。
- `POST /api/payments`：Member Payment Report。
- `POST /api/workspace/payments/[id]/confirm`：Owner 確認付款。
- `POST /api/workspace/payments/[id]/reverse`：Owner 撤銷付款並追加 adjustment。
- `GET/POST/PATCH /api/workspace/payment-accounts`：Owner 管理已認列的 Astera 收款帳戶。
- `GET /api/payment-accounts`：會員只讀目前啟用的公開收款帳戶摘要。
- `POST /api/cancellations`：Member 依 OrderItem 取消或建立申請。
- `POST /api/workspace/cancellations/[id]/review`：Owner 填退款 metadata、核准或拒絕。
- Owner API 必須檢查 custom claim；所有會員 API 必須檢查資料擁有權。

收款帳戶主檔採新增且受 Client SDK deny 的 `paymentAccounts` Collection；它是付款營運設定，不是 Finance／Wallet 模組。完整帳號不保存於此 MVP，僅保存可供人工辨識的末五碼。

## 15. 測試與驗收

### 15.1 Unit／API／Rules

- Campaign UTC+8 轉換、回讀、空值、跨日與無效日期。
- 收款銀行帳戶認列、啟用／停用、Payment Report 綁定有效帳戶與歷史快照。
- SKU 原子序號、封存不補號、價格優先與 Campaign 狀態。
- Checkout 拆單、orderNumber、Consent、idempotency。
- Payment Report、pendingReview、部分／足額／超額、unallocated、reverse、adjustment。
- 未付款取消、已付款取消、退款 metadata、Audit Log 不可變。
- Owner／Helper／Member／跨會員 Rules 拒絕矩陣。
- Storage Owner 上傳、Member／匿名拒絕、路徑／檔案類型／大小限制。

### 15.2 Playwright／手機

- 未登入、Member、Owner、Helper 權限驗收。
- 商品列表、詳情、付款頁與銀行帳戶認列狀態。
- 多 Variant／多 Campaign、Campaign 時間回讀、封存與 projection。
- Checkout 拆單與二補 Consent。
- Payment Report、Owner confirm／reverse、取消與退款審核。
- 桌機、390px 手機、768px 平板及 Pixel 7。
- Focus、Skip Link、ARIA、Loading／Empty／Error／Retry、44px 觸控目標。

## 16. 正式上線 Gate

### 封閉測試 Gate

- Campaign 日期修正與自動化測試全綠。
- 權限與跨會員資料拒絕全綠。
- 測試專用付款／取消流程完整通過。
- 多 Variant／Campaign、SKU、價格、projection、拆單通過。
- TypeScript、ESLint、Unit、Rules、Build、Playwright、secret scan 通過。

### 公開上線 Gate

- Firebase Blaze 與正式 Storage bucket 已建立。
- Development 及 Production Rules 已備份、部署並驗證。
- 正式商品 migration dry-run、backup、projection audit 與重新儲存同步完成。
- Vercel OIDC／GCP Workload Identity 與 Admin API 通過驗證。
- Resend `updates.asteratw.com` SPF／DKIM、API key 與實際收信完成。
- 正式網域、Firebase Authorized Domains、Vercel Environment Variables 完成。
- Astera 品牌、客服、FAQ、付款、二補、取消、配送、Terms、Privacy 內容已由營運／法律確認。
- Production desktop、Pixel 7、實機手機 smoke test 通過。
- Changelog、Decision Log、Deployment、Test Plan、SOP、執行計畫與交接文件更新。

## 17. 目前未完成與外部阻塞

以下不能只靠本機程式自行完成：

- Firebase Blaze／Production Storage bucket。
- Production Storage Rules deployment（Firestore／Storage Rules 已部署；Production live upload 仍待驗收）。
- 正式商品重新儲存與 projection audit。
- Resend DNS、API key 與實際收信。
- 正式網域與 Firebase／Vercel 網域設定。
- 營運客服、社群、FAQ、付款、二補、取消、配送內容確認。
- Terms／Privacy 及二補／退款法律文字確認。
- Production 真人付款／取消與實機手機驗收。

目前已核對的 Production 狀態：`astera-oms-prod`（project number `1032606875618`）存在；Vercel OIDC Workload Identity Pool／Provider 為 ACTIVE，`astera-vercel-admin` 已有 workload identity binding 與最小角色。Production Blaze 已啟用，預設 bucket `gs://astera-oms-prod.firebasestorage.app` 已在 `ASIA-EAST1` 建立並連結，Firestore／Storage Rules 均已部署；Firebase CLI 已由 `ting1811tin@gmail.com` 登入，ADC 需重新以同一個 Production 權限帳號登入確認，且 `asteratw.com`、`www.asteratw.com`、`updates.asteratw.com` 尚無可驗證 DNS 紀錄。
Vercel Production 已配置 Firebase 與 OIDC 變數名稱，並已設定 `RESEND_FROM_EMAIL` 與 `RESEND_REPLY_TO_EMAIL`；嚴格環境檢查目前只缺 `RESEND_API_KEY`，需等待 Resend 網域驗證與 Owner 提供正式 Secret。
唯讀商品 projection audit 已在 ADC 修正後通過：`internalCount=2`、`publicCount=2`、`issues=[]`。Owner 核准後已建立本機忽略備份並重新儲存 2 筆 `productsPublic` projection；同步後 audit 仍為 `internalCount=2`、`publicCount=2`、`issues=[]`。
Development 專案 `astera-oms-dev-b2b2e` 已啟用 Blaze，連結 billing account `01B794-2E6BD7-33D714`，並建立 `gs://astera-oms-dev-b2b2e.firebasestorage.app`（`ASIA-EAST1`）；Development Firestore／Storage Rules 也已部署。

文件不把上述外部條件標示為已完成；每次交接必須保留阻塞原因、負責人、下一步與驗收證據。

## 18. 目前工程狀態備註

- 既有 Product／Variant／Campaign、SKU、Checkout 拆單、Payment／Cancellation 基礎流程與多數測試已存在。
- Campaign UTC+8 日期契約已在本地完成；既有 projection 測試期望值已同步更新。
- `Member Preorder（會員預購）` 暫不實作；不得出現在目前版本 Sale Type、前台選單、Checkout 或測試資料。
- 銀行帳戶認列已在本地完成資料型別、Owner API、付款頁、Rules、Unit 與 authenticated Playwright；仍需 production 帳戶設定與正式收款流程驗收。
- Member Dashboard 本輪只完成視覺骨架，不新增完整待辦業務。
- 新版視覺 Token 已確認採用；`src/app/globals.css` 建立全域契約，首頁、品牌中心與 Workspace 外框已直接使用 `astera-*` Token，其餘舊 utility 以相容映射維持畫面一致；仍需真機與 Production 視覺驗收。
- 本文件是需求與驗收基準，不代表所有列出的功能目前均已完成。

## 19. 2026-08-02 Owner 決策修訂：會員匯款帳戶

本節優先於本文件較早的「完整帳號不保存」描述：

- 會員可自行新增最多 5 筆自己的匯款銀行帳戶，付款回報時選擇其中一筆。
- 完整銀行帳號由受保護 Server 保存；API 與前端不得回傳完整值。
- 會員畫面顯示遮罩：開頭三位隱碼、中段隱碼、尾碼五位可辨識，例如 `***••••89012`；同時保存 `accountNumberLast5` 供對帳。
- 第 6 筆不得新增。會員須提出封存申請，Owner 核准後狀態改為 `inactive`；不實體刪除，付款歷史不受影響。
- `paymentAccounts` 仍保留作為 Owner 管理的 Astera 收款目的地；`memberPaymentAccounts` 是會員匯款來源，兩者都保存並分開管理。
- 建立訂單前不檢查會員是否已有銀行帳戶；`POST /api/payments` 付款回報時必須同時提供有效的 `receivingPaymentAccountId` 與 `memberPaymentAccountId`。
- 訪客可瀏覽，但商品列表／詳情加入購物車前必須使用 Google 登入；Server Checkout 仍要求完整會員資料。

## 20. 2026-08-02 本地實作驗證

- 新增會員帳戶 API、Owner 封存審核 API、會員帳戶頁與付款回報雙帳戶選擇。
- 商品列表改為響應式 Grid、商品圖 4:5、公開 Header、訪客加入購物車登入閘門。
- Unit：36 files／169 tests 通過；Rules：31 tests 通過；受影響付款／取消 E2E 桌機與手機通過；完整 Emulator Playwright：31 passed、3 skipped。
- 最新程式尚需完成 Preview／Production 部署後的真人會員與 Owner 驗收；不得將本節本地測試結果視為正式服務已完成。
