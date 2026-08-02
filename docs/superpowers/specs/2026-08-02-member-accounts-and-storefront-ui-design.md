# Astera 會員匯款帳戶與前台 UI 設計

日期：2026-08-02  
狀態：Owner 已同意設計方向，待規格文件複核後實作  
範圍：會員自己的匯款帳戶、Astera 收款帳戶、訪客登入閘門、公開前台 UI 對齊

## 1. 設計目標

- 讓會員清楚區分「匯入哪個 Astera 收款帳戶」與「從哪個自己的銀行帳戶匯出」。
- 會員最多保存五筆自己的匯款帳戶；達上限後只能提出封存申請。
- 完整銀行帳號只由受保護 Server 使用，畫面顯示遮罩格式（遮住開頭三位、顯示尾碼五位，例如 `***12345`）。
- 訪客可瀏覽公開商品，但加入購物車與下單前必須使用 Google 登入。
- 前台改為收藏選物店優先的資訊架構，商品圖片、價格、Campaign 與結單時間優先於 OMS 說明卡。

## 2. 已確認邊界

- 兩種帳戶都保留：
  - `paymentAccounts`：Owner 管理的 Astera 收款目的地。
  - `memberPaymentAccounts`：會員自己的匯款來源。
- 建立訂單前不檢查是否已有銀行帳戶；付款回報時才要求有效的兩種帳戶。
- 付款方式仍只有銀行匯款。
- 未付款、付款、取消、歷史快照與 Audit Log 的既有資料模型不重設計。
- 不加入 Member Preorder、Excel 對帳、完整 Dashboard 待辦業務或其他 ERP 功能。

## 3. 資料模型與安全邊界

### 3.1 會員匯款帳戶

新增 `memberPaymentAccounts` Collection，文件至少包含：

```text
id
memberUid
bankName
branchName (optional)
accountName
accountNumberFull (server-only)
accountNumberLast5 (derived)
status: active | pendingDeletion | inactive
createdAt / createdBy
updatedAt / updatedBy
deletionRequestedAt / deletionRequestedBy (optional)
archivedAt / archivedBy (optional)
```

規則：

- 每位會員最多五筆 `active` 或 `pendingDeletion` 帳戶；上限由 Server transaction 強制，不信任前端計數。
- 同一會員的完整帳號正規化後不可重複。
- Client SDK 不得讀寫此 Collection；會員與 Owner 均透過受保護 API 取得必要的遮罩資料。
- API 回應不返回 `accountNumberFull`；只返回遮罩帳號與末五碼。
- 封存採狀態變更，不實體刪除。
- 會員提出封存申請後進入 `pendingDeletion`，Owner 核准後改為 `inactive`；歷史付款不受影響。

### 3.2 Astera 收款帳戶

保留既有 `paymentAccounts`：

- Owner 建立、啟用與停用。
- 會員付款回報時只能選擇 `active` 帳戶。
- 歷史 Payment 保存遮罩的收款帳戶快照。

### 3.3 Payment Report

`POST /api/payments` 同時接受並由 Server 驗證：

- `receivingPaymentAccountId`：Astera 收款目的地。
- `memberPaymentAccountId`：會員匯款來源。

Payment 保存兩個帳戶的 ID 與遮罩快照。完整會員帳號只留在受保護的會員帳戶文件，不複製到公開或一般會員讀取資料。

## 4. API 與頁面

### 4.1 會員 API

- `GET /api/member/payment-accounts`：自己的帳戶遮罩清單。
- `POST /api/member/payment-accounts`：新增帳戶；Server 驗證五筆上限、格式與重複。
- `POST /api/member/payment-accounts/[id]/deletion-request`：提出封存申請。
- `GET /api/payment-accounts`：只回傳目前啟用的 Astera 收款帳戶摘要。

### 4.2 Owner API

- 保留 `/api/workspace/payment-accounts` 管理 Astera 收款目的地。
- 新增受 Owner claim 保護的會員帳戶封存申請清單與審核 API。
- Owner 審核只能追加 Audit Log 並變更狀態，不刪除付款歷史。

### 4.3 UI 路徑

- `/account/bank-accounts`：會員新增、查看遮罩帳戶、提出封存申請。
- `/payments`：先選 Astera 收款帳戶，再選自己的匯款帳戶；兩者都有效才可送出 Payment Report。
- `/workspace/payments#payment-accounts`：Owner 管理 Astera 收款帳戶。
- `/workspace/payments#member-payment-account-requests`：Owner 審核會員封存申請。

## 5. 訪客登入閘門

- 未登入訪客可以瀏覽公開商品與內容。
- 商品列表、商品詳情的「加入購物車」在未登入時觸發 Google 登入，不建立匿名購物車業務資料。
- `/cart` 的建立訂單操作在未登入時顯示登入導向；Server Checkout 仍以 Firebase ID token 為唯一信任來源。
- 登入成功後回到原商品或購物車頁；若會員資料未完成，導向 `/account/profile`。
- Checkout API 追加 Server-side profile completion guard，必要欄位為姓、名、社群內 ID、台灣手機號碼；生日仍選填。
- 不因缺少銀行帳戶阻止建立訂單；付款回報階段才顯示帳戶綁定提示。

## 6. 公開前台 UI 對齊

- Header 提供 Logo、首頁、販售活動／品牌、所有商品、購物車與登入狀態。
- 首頁先展示最新販售、Campaign 與商品圖片，再展示流程與服務說明。
- 商品列表使用響應式 grid：大桌面 4–5 欄、平板 3 欄、手機 2 欄；不以單張大型卡片取代列表。
- 商品圖片固定 4:5，商品卡顯示名稱、價格、Sale Type、Campaign 與結單時間。
- Campaign 結單時間若缺失，後台新活動應阻止發布；既有舊資料需在 migration／Owner 編輯時補齊。
- 使用新版 `color.page`、`color.surface`、`color.ink`、`color.brand`、`color.service`、`color.campaign`、`color.catalog` Token；保留成功、錯誤、警告的獨立語意色。
- `/ux-acceptance` 僅供 Emulator／Preview；Production 必須保護或排除測試頁。

## 7. 測試與驗收

### Unit / API / Rules

- 五筆上限、重複帳號、遮罩格式、封存狀態與歷史快照。
- 非會員不可讀取會員帳戶；跨會員讀取與寫入拒絕。
- Member 只能管理自己的帳戶；Owner 才能審核封存申請。
- Payment Report 必須同時帶有效的會員帳戶與 Astera 收款帳戶。
- Checkout 無帳戶仍可建立訂單；Payment Report 無帳戶必須拒絕。

### Playwright

- 訪客商品詳情加入購物車觸發 Google 登入。
- 會員新增第 1–5 筆帳戶；第 6 筆被拒絕。
- 會員提出封存申請；Owner 核准後可新增新帳戶。
- 付款回報選擇兩種帳戶，成功建立 `pendingReview` Payment。
- 會員、Helper、Owner 與跨會員權限邊界。
- 390px、768px、1365px 的 Header、商品 grid、Payments 與帳戶頁。

## 8. 分批實作順序

1. 會員帳戶 Collection、Rules、API 與五筆上限。
2. 會員帳戶頁與 Owner 封存申請審核。
3. Payment Report 同時選擇兩種帳戶與歷史快照。
4. 訪客登入閘門與 Checkout profile guard。
5. Header、商品 grid、4:5 圖片與結單資訊。
6. 全站新版 Token 與手機驗收。
7. Preview 驗收後再部署 Production。

## 9. 驗收完成條件

- 會員最多五筆、完整帳號不被前端取回、遮罩正確。
- 第六筆新增被 Server 拒絕；封存須 Owner 核准。
- Payment 同時記錄來源與目的地帳戶遮罩快照。
- 訪客不能加入購物車或建立訂單。
- 無銀行帳戶時仍可建立訂單，但不能送出付款回報。
- 商品列表與首頁符合新版視覺規格，桌機／平板／手機無重疊或水平溢出。
- Unit、Rules、TypeScript、ESLint、Build、Playwright 與 Production smoke 全部通過。
