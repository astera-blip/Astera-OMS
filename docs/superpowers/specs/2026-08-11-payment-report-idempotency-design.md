# Astera OMS 付款回報冪等與待審狀態設計

**日期：** 2026-08-11  
**狀態：** 待使用者書面確認  
**範圍：** MVP 付款回報、會員付款狀態、Owner 待審回報處理

## 1. 問題與目標

目前會員送出付款回報後，付款請求仍顯示「待付款」，頁面也不會持續列出已建立的
`pendingReview` Payment。使用者容易誤以為沒有成功，再次按下送出；Server 每次又以
新的隨機 Payment 文件 ID 寫入，因此同一個使用者意圖可能產生重複待審付款。

本設計要同時達成：

- 同一次送出意圖即使因連點、重試或網路重送抵達多次，也只建立一組 Payment。
- 會員重新整理後仍能看到「已回報／待確認／已確認／已拒絕／已撤銷」。
- 不阻止真正的分次付款；新一次付款使用新的冪等鍵即可。
- 重複測試回報不硬刪除，由 Owner 拒絕並保留 Audit Log。
- 不修改既有 Collection 架構，不新增 Wallet 或 Finance 功能。

## 2. 採用方案

### 2.1 Client 冪等鍵

付款表單準備送出時產生一個 `idempotencyKey`。同一次表單送出期間的連點、逾時重試
及相同內容重送必須沿用同一個 key；只有 Server 明確成功後才清除。會員重新建立一筆
新的付款回報時才產生新 key，因此不影響合法分次付款。

前端在請求期間立即鎖定送出按鈕並顯示「送出中…」。這是 UX 防護，不是唯一安全
邊界；Server 冪等仍是正式保證。

### 2.2 Server 冪等寫入

`POST /api/payments` 新增必填 `idempotencyKey`。Server 驗證格式與長度，並以會員 UID、
key 與 allocation index 的 Server-side SHA-256 摘要派生確定性的 Payment 文件 ID；文件
ID 不直接包含 UID 或原始 key。交易中先讀取既有第一筆：

- 不存在：依現有權威 PaymentRequest、收款帳戶及會員匯款帳戶資料建立 Payment。
- 已存在且不可變輸入完全相同：回傳原 Payment group，`alreadyExists: true`，不重寫。
- 已存在但付款請求、金額、日期、收款帳戶、會員帳戶或備註不同：回傳
  `409 idempotency_conflict`。

Payment 保存 `idempotencyKey` 與 Server 產生的不可變請求摘要。前端不能指定 Payment
ID、狀態、帳號快照、payer name 或 HMAC 內容。

### 2.3 會員付款回報讀取

`GET /api/payments` 僅回傳登入會員自己的安全欄位：

- Payment ID、PaymentRequest ID、Payment group ID。
- 回報金額、回報日期、建立時間。
- 狀態：`pendingReview | confirmed | rejected | reversed`。
- 收款帳戶及會員匯款帳戶的遮罩顯示資料。
- 安全的會員備註。

不得回傳完整銀行帳號、HMAC 指紋、KMS key version、內部審核理由或其他會員資料。

會員付款頁新增「我的付款回報」區塊，中文顯示：

- `pendingReview`：已回報／待確認。
- `confirmed`：已確認。
- `rejected`：未通過。
- `reversed`：已撤銷。

付款請求在 Owner 確認前仍可維持既有 `open`／「待付款」資料狀態，但同頁必須明確顯示
已有待審回報，避免把「尚未確認」誤解成「沒有送出」。

## 3. Owner 拒絕重複或錯誤回報

新增 `POST /api/workspace/payments/[id]/reject`：

- 只允許 Firebase custom claim `owner`。
- 只接受 `pendingReview` Payment。
- 拒絕理由必填。
- Payment 更新為 `rejected`，保留原始回報及安全帳戶快照。
- 建立不可修改 Audit Log，action 為 `payment.rejected`。
- 不建立 allocation、不改 PaymentRequest、Order 或 OrderItem 金額／狀態。
- 重複拒絕相同 Payment 回傳冪等成功；已 confirmed／reversed 的 Payment 不可拒絕。

Owner UI 對待審 Payment 提供「確認匯款」與「拒絕回報」。拒絕前需再次確認，且介面明確
說明只會拒絕該筆回報，不會刪除訂單或付款歷史。

現有兩筆同一付款請求的測試回報不得直接刪除。部署完成後，Owner 選定正確的一筆處理，
另一筆使用「拒絕回報」並填寫測試重複回報理由。

## 4. 錯誤與競態處理

- Client 的 `isSubmitting` 與同步 request guard 同時防止同一 render 週期連點。
- Server 交易是最終防線；兩個同 key 請求並行時只能建立一組文件。
- 逾時或不確定結果時，Client 使用同一 key 重試並取得原結果。
- `idempotency_conflict` 顯示「付款回報內容已變更，請重新整理後建立新的回報」。
- 回報成功後立即重新讀取 Payment list；讀取失敗時仍保留成功提示並提供「重新載入」。
- 所有錯誤訊息不得輸出 token、完整帳號、指紋、Firestore 路徑或內部 stack。

## 5. 測試與驗收

### Unit／API

- 相同 key、相同 payload 連續及並行送出只建立一組 Payment。
- 相同 key、不同 payload 回傳 409。
- 不同 key 可對同一 PaymentRequest 建立合法分次付款。
- GET 只回傳本會員 Payment，且不含完整帳號、指紋與 key version。
- Owner 可拒絕 pendingReview；Member、Helper 被拒絕。
- 拒絕不建立 allocation，也不改 Order／PaymentRequest。

### Playwright

- 快速連點只產生一筆待審回報。
- 送出後及重新整理後都顯示「已回報／待確認」。
- Owner 拒絕重複測試回報後，會員頁顯示「未通過」。
- 真正第二次付款使用新 key，仍可建立另一筆 Payment。

### 完成條件

- Unit、TypeScript、ESLint、Build、Firestore Rules 及相關 Playwright 全綠。
- Ready Preview 完成會員送出、重新整理、Owner 拒絕與會員狀態回讀驗收。
- 現有重複測試 Payment 只透過 reject 處理，不刪除。
- 更新執行計畫、交接、Test Plan 與 Changelog。

## 6. 明確不做

- 不以「同一付款請求已存在待審 Payment」全面阻止分次付款。
- 不只依賴前端 disabled 防重複。
- 不硬刪除重複 Payment。
- 不讓 Client 指定 Payment 狀態、ID 或帳戶快照。
- 不在會員 API 回傳完整帳號、HMAC 指紋或 KMS 資訊。
