# Astera OMS 台新 Excel 批次對帳與付款認列設計

日期：2026-08-13  
狀態：規格方向已口頭確認，待 Owner 審閱本文件

## 1. 目標

將現有只能以「單筆金額＋帳號末五碼」查找的台新 Excel 預覽工具，擴充成 Owner 可操作的批次對帳流程：

1. Owner 上傳台新銀行 `.xlsx` 交易明細。
2. Server 解析銀行交易，並與所有 `pendingReview` 付款回報批次比對。
3. 畫面依安全性分類顯示比對結果。
4. Owner 可「全選可認列項目」，再取消不應認列的項目。
5. Owner 二次確認後才批次認列，並逐筆留下既有付款分配與 Audit Log。

本功能不自動確認付款，不新增 Wallet、Finance 或其他 ERP 功能。

## 2. 已確認的產品決策

- 採用「批次比對＋Owner 人工確認」，不採全自動認列。
- 提供「全選可認列項目」與「全部取消」按鈕。
- 全選只能勾選系統判定為「唯一吻合且可安全認列」的項目。
- Owner 可取消任何已勾選項目；多筆可能、未找到、資料不足與疑似重複項目不會被全選。
- 批次確認前必須顯示即將認列的筆數，並要求 Owner 再次確認。
- 批次中某一筆失敗時，不回滾其他已成功項目；畫面逐筆顯示成功或失敗。

## 3. 比對分類

### 3.1 唯一吻合

同時滿足下列條件才可被「全選可認列項目」勾選：

- Excel 交易金額與 Payment 回報金額相同。
- Excel 備註解析出的帳號末五碼，與 Payment 建立時保存的會員匯款帳號 snapshot 末五碼相同。
- Payment 狀態仍為 `pendingReview`。
- 只有一筆 Payment 與該銀行交易吻合。
- 只有一筆銀行交易與該 Payment 吻合。
- 該銀行交易尚未被其他 Payment 認列。

台新檔案若可靠提供銀行代碼，另驗證銀行代碼；若檔案未提供，不自行猜測。匯款人姓名與匯款日期可顯示為人工復核資訊，但不取代金額與末五碼主比對條件。

### 3.2 多筆可能

同一銀行交易或同一 Payment 有多個候選。畫面顯示候選資訊，但不允許納入批次全選，必須後續個別復核。

### 3.3 未找到

Excel 交易找不到任何相符的 `pendingReview` Payment，或 Payment 找不到銀行交易。

### 3.4 資料不足

Excel 交易無法解析金額或帳號末五碼，不納入自動候選。

### 3.5 疑似重複

銀行交易已被認列，或同一檔案內出現無法唯一區分的重複交易。這類項目不可勾選認列。

## 4. Server 權威資料流

### 4.1 預覽比對

Owner 將 `.xlsx` 送至受保護 API。Server 必須：

1. 驗證 Firebase ID token 與 Owner custom claim。
2. 驗證 `.xlsx` 副檔名、MIME type、10 MB 上限、必要欄位與資料列。
3. 解析台新交易並產生不含餘額、完整備註或完整帳號的安全化資料。
4. 使用 Admin SDK 重新讀取所有 `pendingReview` Payment。同一次會員付款回報若分配至多張訂單，以 `paymentGroupId` 聚合為一個對帳單位，並用該群組全部 Payment 金額加總與單筆銀行交易比對。
5. 建立比對結果，回傳分類、Payment group 與 Payment ID、訂單編號、金額、遮罩帳號、匯款人與交易日期等復核資訊。

原始 Excel 及完整備註不寫入 Firestore、Storage、log 或 API response。

### 4.2 批次確認

前端不能單獨傳入「這筆已吻合」的布林值來認列。批次確認時必須重新上傳同一份 Excel，並傳送 Owner 勾選的 Payment ID 與對應交易識別值。Server 重新解析 Excel、重新讀取 Payment，並逐筆重做全部安全條件驗證。

驗證通過後，每筆認列沿用既有 Owner payment confirm 領域邏輯，不從前端傳入金額、PaymentRequest 狀態或訂單狀態。Server 負責：

- 確認 Payment 仍為 `pendingReview`。
- 依既有規則重算 PaymentRequest、Order 與 OrderItem。
- 追加 PaymentAllocation 與不可修改 Audit Log。
- 在 Payment 保存安全化對帳 metadata，用於阻擋同一銀行交易重複認列。

批次端點以逐筆結果回應，不使用整批全成功或全回滾語意。

## 5. 銀行交易識別與重複防護

不儲存原始銀行備註。Server 以正規化後、不含完整帳號的必要欄位產生 SHA-256 交易指紋，至少包含：

- 交易日期時間。
- 帳務日。
- 收入金額。
- 交易方式。
- 解析後帳號末五碼。
- 解析後帳號末五碼，不納入原始備註或其他完整數字群。

指紋只用於重複防護，不作為對外顯示的交易編號，也不被當作安全身分憑證。相同指紋已連結其他已確認 Payment 時，新認列必須拒絕。

## 6. Owner 操作介面

`/workspace/payments` 的台新對帳區改為：

1. **上傳區**：檔案、檔案規格說明、「解析並批次比對」按鈕。
2. **摘要區**：Excel 交易筆數、待審 Payment 筆數、唯一吻合、多筆可能、未找到、資料不足、疑似重複數量。
3. **批次工具列**：「全選可認列項目」、「全部取消」、已選筆數、「批次確認認列」。
4. **結果清單**：每筆顯示 checkbox、分類 Badge、交易日期、金額、帳號末五碼、匯款人、訂單編號、Payment ID 的簡短識別文字與判定理由。
5. **結果狀態**：未處理、認列中、已認列、失敗、已取消勾選。

只有「唯一吻合」可勾選。其他類別顯示不可勾選的明確原因，不使用只靠顏色的狀態表達。

## 7. 錯誤處理

- 檔案過大、格式錯誤、缺欄、空檔案或無法辨識的資料列：整份拒絕，不顯示部分結果。
- Token 過期或 Owner 權限不足：拒絕匯入與批次認列。
- 預覽後 Payment 狀態已變更：該筆回報 `stale_payment`，不影響其他項目。
- 預覽後上傳了不同 Excel，或交易與 Payment 不再唯一吻合：該筆拒絕。
- 同一批內或歷史已認列的交易指紋重複：該筆回報 `duplicate_reconciliation`。
- 批次結果保留在當前畫面，Owner 可只重試失敗項目，不需重新認列已成功項目。

## 8. 測試範圍

### Unit

- 真實台新兩列表頭格式與日期、金額、末五碼解析。
- 空白列、數字格式、前導零、重複交易與缺失欄位。
- 唯一吻合、多筆可能、未找到、資料不足與疑似重複分類。
- 「全選」只選取可安全認列項目。
- 交易指紋穩定性與不含原始敏感資料。

### API

- 匿名、Member 與 Helper 不可上傳或認列。
- Owner 預覽只讀取 Admin SDK 權威 Payment 資料。
- 批次確認重新解析檔案與驗證每筆配對。
- 部分成功、狀態過期、重複交易與變造前端 payload。
- 成功認列會建立既有 PaymentAllocation 與 Audit Log。

### Playwright

- Owner 上傳合成、無真實個資的台新 Excel fixture。
- 結果正確分類，全選不包含不可認列項目。
- Owner 取消一筆勾選後批次確認。
- 成功項目變為已認列，未勾選項目不變，失敗項目顯示可理解中文訊息。
- 成功後重新匯入同一檔案，已用交易顯示疑似重複且無法再勾選。

## 9. 非目標

- 不自動登入網路銀行。
- 不保存或上傳原始 Excel 至 Firebase Storage。
- 不建立通用銀行格式設計器。
- 不新增 Wallet、會計總帳或其他 Finance／ERP Collection。
- 不因 Excel 匯入直接覆寫或刪除 Payment、PaymentAllocation 或 Audit Log 歷史。

## 10. 完成條件

- 系統可將一份台新 Excel 與所有 `pendingReview` Payment 批次比對。
- 全選只勾選唯一吻合項目，Owner 可取消勾選後批次認列。
- Server 在認列時重新驗證 Excel 與 Firestore 權威資料。
- 同一銀行交易不可重複認列。
- 原始 Excel、完整帳號、餘額與原始備註不寫入 Firestore 或前端 response。
- Unit、API、Firestore Rules、TypeScript、ESLint、Build 與 Playwright 全部通過。
