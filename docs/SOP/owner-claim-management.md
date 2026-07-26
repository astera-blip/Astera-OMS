# Owner Claim Management SOP

## 目的

將 owner 權限固定在 Firebase custom claim，避免再依賴 email 後門。

## 前置條件

- 只在本機執行。
- `GOOGLE_APPLICATION_CREDENTIALS` 指向專案外的 service-account JSON。
- 明確指定 Firebase project。
- 操作前先確認目標帳號 email 無誤。

## 指派 owner

1. 使用管理腳本寫入 claim。

```bash
npm run admin:set-role -- --project astera-oms-prod --confirm-project astera-oms-prod --email astera.0920@gmail.com --role owner --actor-uid local-admin
```

2. 重新讀取 Firebase Auth user，確認 `customClaims.role` 已變成 `owner`。
3. 使用者登出後重新登入，或強制刷新 ID token。
4. 驗證 owner-only 頁面、付款操作、Audit Log 可正常存取。

## 撤銷 owner

1. 使用管理腳本把 `role` 改回 `member`。
2. 重新讀取 Firebase Auth user，確認 claim 已更新。
3. 要求使用者重新登入，避免舊 token 仍保有權限。
4. 再驗證 owner-only 頁面與資料已拒絕存取。

## 避免鎖死後台

- 先寫 claim，再改程式與 rules。
- 先確認 owner 可重新登入且 token 刷新成功，再移除任何 bootstrap 邏輯。
- rules 與應用程式上線後，立即用一般 member 帳號驗證 owner-only 路徑不可讀。
- 如果 claim 寫入失敗，不要先部署移除後門的 rules。

## Audit Log

- 每次角色變更都要寫入 `auditLogs`。
- 不要寫入 service-account JSON 內容。
- auditLog 只記錄 email、project、角色前後差異與操作來源。
