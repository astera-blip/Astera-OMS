# 可回復 Checkout Preview 測試設計

## 目的

在 Vercel Preview 驗證 Astera OMS 的真實受保護 Checkout 與未付款取消流程，同時避免真實匯款、退款、出貨或正式環境資料變更。

## 範圍與限制

- 僅使用 `codex/mvp-completion` 的 Vercel Preview；不得使用 Production 網址或 Production 資料。
- 測試登入帳號為 `astera.0920@gmail.com`。此帳號具有 Owner custom claim；本次結果不能視為非 Owner 的 Workspace 拒絕驗證。
- 不建立或索取 Google 帳號密碼，不覆寫既有會員 Profile。
- 不測試匯款回報、付款確認、付款撤銷、人工退款或已付款取消審核。
- 不直接刪除任何訂單、付款請求、ConsentRecord、Audit Log 或通知事件；這些紀錄是不可變的營運稽核資料。

## 測試資料

以 Owner Workspace 建立下列 Preview 專用資料：

| 項目 | 值 |
| --- | --- |
| 商品名稱 | `【測試專用】Preview Checkout — 請勿付款` |
| Variant | `Test Variant（測試規格）` |
| Campaign | `TEST-ONLY Preview Checkout — 請勿付款` |
| 販售類型 | `Preorder` |
| 狀態 | `Open`，時間覆蓋測試期間 |
| 售價 | NT$1 |
| 收件人 | `Preview Test — 請勿出貨` |
| 收件電話 | `0900000000` |
| 收件地址 | `Preview only — 不出貨、不付款` |
| 取消原因 | `Preview Checkout reversible test — no payment, do not fulfil` |

商品、Variant 與 Campaign 的 ID / SKU 均由既有 Server API 自動派發。不得手動指定或改寫 SKU。

## 執行流程

1. 在 Preview 登入測試帳號，記錄開始時間、Preview URL 與既有購物車內容；若現有購物車不是測試商品，先不覆寫或清除。
2. 建立並確認測試商品已經公開投影至 `productsPublic`，前台只可看見公開名稱、售價與 Campaign，不可出現成本、內部備註或 SKU。
3. 僅將測試商品加入購物車，確認購物車重新載入後仍保留正確品名、規格、Campaign 與 NT$1 總額。
4. 填寫上表的非真實收件資訊，勾選下單條款／隱私權政策與二補規則，送出一次 Checkout。
5. 記錄建立結果：`orderId`、`orderNumber`、`paymentRequestId`、`checkoutGroupId`（可由後台或安全伺服器紀錄核對），以及建立時間。
6. 確認訂單狀態為 `awaitingPayment`、OrderItem 為 `awaitingPayment`、PaymentRequest 為 `open`，並已建立 ConsentRecord 與 order-created notification event。
7. 不匯款、不建立 Payment Report、不由 Owner 確認付款。由會員訂單頁選取此唯一測試 OrderItem，以固定測試取消原因送出取消。
8. 確認直接取消後：Order、OrderItem 與 PaymentRequest 均為 `cancelled`，訂單總額與付款請求金額重算為 NT$0，沒有 `pending` cancellation request、payment 或 adjustment。
9. 將測試商品與 Campaign 改為 `Archived`，確認不再出現在前台；不要硬刪 Product、Variant、Campaign 或其 Storage 物件。
10. 保存執行證據並更新 `docs/16_MVPCompletionPlan.md` 與 `docs/17_ProjectHandoff.md`，記錄結果、發現的缺陷、修正提交、部署與未完成事項。

## 可回復的定義

本測試的「可回復」是指：沒有金流、出貨或待處理訂單，測試商品已封存且不再對買家可見。不可變稽核資料仍會保留，包括：

- 已取消的 Order、OrderItem、PaymentRequest；
- ConsentRecord；
- 取消 Audit Log；
- order-created notification event 與寄送狀態。

這些資料不得為了清潔測試環境而直接從 Firestore 刪除。

## 通知與風險控制

- Checkout 會嘗試向 `astera.0920@gmail.com` 建立／寄送測試訂單通知；通知信應能明確辨識為 `TEST-ONLY` 商品。
- 寄信失敗不得影響訂單建立或取消驗證；僅記錄通知事件狀態。
- 若商品投影、購物車、Checkout、取消或後台封存任何一步失敗，立即停止後續測試，不重複送出 Checkout；先記錄 order / attempt ID、讀取安全的 Server 錯誤資訊、修正、部署並自頭開始新的專用測試資料。

## 驗收條件

- Preview 的受保護 API 成功建立一筆且只有一筆專用測試訂單。
- Server 產生正式格式的 order number 與付款請求，且前端顯示一致。
- 未付款直接取消完成後，沒有待處理金流或取消審核。
- 前台無法再看見已封存測試商品。
- 測試全程沒有實際匯款、付款確認、退款或出貨。
- 所有資料異動、測試結果及失敗修正均被寫入交接文件。
