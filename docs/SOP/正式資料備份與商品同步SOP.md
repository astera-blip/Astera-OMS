# 正式資料備份與商品同步 SOP

## 目的與安全邊界

本 SOP 用於 Astera OMS production 商品重新儲存與
`productsInternal → productsPublic` 同步。`production:products:audit` 為唯讀；
`production:products:sync --apply` 是唯一正式 projection 寫入工具，任何寫入、
遷移或 Rules 部署都必須另行核准。備份只能放在 Git 已忽略的
`.local-backups/`，不得提交到 repository。

## 1. 執行前確認

1. 確認目前分支與預定 release commit，工作樹不得混入 `.env` 或備份。
2. 使用 Vercel OIDC / GCP Workload Identity 或本機短期 Application
   Default Credentials；不得建立或保存長期 service-account JSON key。
3. 確認目標專案為 `astera-oms-prod`，Firebase Console 顯示的 Project ID
   必須與指令兩次輸入完全相同。
4. 執行 `npm run check:secrets`。
5. 執行 `npm run production:env:check`，確認 Emulator 與 E2E Auth flags
   未啟用。輸出不得包含任何值。

## 2. 建立可復原備份

1. 建立 `.local-backups/<UTC timestamp>/`。
2. 使用受核准的 Firebase / Google Cloud 匯出功能備份下列範圍：
   `productsInternal`、`productsPublic`、`productVariants`、
   `saleCampaigns`、`siteSettings/system-sequences`。
3. 記錄 Firebase operation ID、Project ID、UTC 時間、操作者及 release
   commit；不要把憑證或完整會員資料寫入紀錄。
4. 確認匯出 operation 成功，並在執行遷移前驗證備份目的地可讀。

## 3. Dry-run 與差異核對

```powershell
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
```

核對項目：

- `productsInternal` 與 `productsPublic` 文件數及 ID。
- Product SKU `AST-P000001` 與 Variant SKU `AST-P000001-V001` 格式。
- Variant、Campaign、價格與商品圖片數量及公開欄位。
- `productsPublic` 不含 SKU、成本、內部備註、操作者 UID。
- 首張圖片順序為 1，路徑屬於對應 Product。

任何 issue 都停止；先修正程式或資料計畫，再重新備份與 dry-run。

## 4. 發布與同步順序

1. 部署已通過 CI 的 Vercel release，先驗證 OIDC Admin API。
2. 在 development 部署 Firestore / Storage Rules 並完成匿名公開讀與私有拒絕。
3. 經 Owner 核准後部署 production Rules。
4. 取得 Owner 明確核准後執行：
   `npm run production:products:sync -- --project astera-oms-prod --confirm-project astera-oms-prod --apply`。
   工具會先建立 `.local-backups/` 備份，再以 sanitized projection 重新儲存；不得由 Client SDK
   直接寫入，也不得手動修改 SKU。
5. 同步後重新執行 product audit；結果全綠才繼續下一批。
6. 完成後執行 anonymous production smoke 與桌機、Pixel 7、實機驗收。

## 5. Smoke

```powershell
npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
```

驗證首頁、商品列表、Terms、Privacy，以及 `--product-id` 指定的已刊登商品
詳情。商品目錄由 Client 端載入，因此不可依賴原始 HTML 自動尋找商品連結。
若 `prod_002` 已封存，先從稽核結果選擇另一筆目前已刊登的公開 Product ID。
請另以未登入瀏覽器確認 `productsPublic` 可讀、後台與私有資料拒絕。

## 6. 回滾與復原

1. 若僅 Vercel release 異常，立即把 production alias 回切上一個已驗證
   deployment；資料不回寫。
2. 若 Rules 阻擋正常流量，部署上一版已留存且測試通過的 Rules。
3. 若商品 projection 錯誤，先停止 Product 寫入；保留錯誤現場與 audit
   輸出，再由核准的 Firebase restore/import 作業從第 2 節備份復原。
4. 復原後重跑 product audit、anonymous smoke、Owner/Member 關鍵流程。
5. 在 `docs/17_ProjectHandoff.md` 記錄 operation ID、受影響文件、時間、
   驗證結果與下一步；不得記錄 secret。
