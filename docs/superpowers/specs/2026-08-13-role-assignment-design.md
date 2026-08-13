# Astera OMS 角色指派與權限防護設計

日期：2026-08-13
狀態：已確認，待使用者審閱文件後進入實作計畫

## 1. 目標與本批範圍

本批只完成安全的角色指派與權限防護，讓 Owner 可將既有會員改為 Partner、Helper 或 Member。正式權限來源維持 Firebase Custom Claim；不以 Email 或 Firestore 欄位判斷角色。

本批不變更 Collection 架構、Checkout 商業邏輯、Firestore Rules 的業務寫入原則，也不實作 Partner 商品草稿、Helper 搶購成本、分潤或 ERP／Finance 功能。

## 2. 角色模型

角色由高至低：`owner > partner > helper > member`。

| 角色 | 本批可用能力 | 本批限制 |
| --- | --- | --- |
| Owner（最高管理者） | 指派 Partner／Helper／Member、既有所有 Owner 後台能力 | 網站不可授予、移除或轉移 Owner |
| Partner（合作人） | 本批取得角色識別與重新登入後通知 | 尚不開放商品、內容、成本或訂單工作台權限 |
| Helper（小幫手） | 本批維持既有會員功能 | 尚不開放 Workspace、搶購或成本功能 |
| Member（會員） | 既有會員資料、購物車、訂單、付款、取消與帳戶功能 | 不可存取後台或高風險操作 |

Owner 繼承 Partner 與 Helper 未來能力。角色階層不代表本批立刻顯示未實作的 Workspace 功能。

## 3. 角色指派流程

1. Owner 在會員管理頁選擇已完成會員資料的非 Owner 帳號。
2. Owner 選擇新角色：Partner、Helper 或 Member。
3. 介面顯示目前／新角色及「對方會被登出，重新登入後生效」；Owner 必須二次確認。
4. 受保護 API 以 Owner Custom Claim 驗證請求，更新目標 Firebase Custom Claim。
5. Server 寫入不可修改的角色異動 Audit Log：操作者、目標、舊角色、新角色、時間與固定原因 `role_assignment`。
6. Server 撤銷目標帳號 Refresh Token。受保護 API 驗證撤銷狀態，避免舊 ID token 繼續使用。
7. 目標會員重新登入後，取得新 Claim，並在首頁或工作區看到一次角色已更新通知；本批不寄送 Email。

API 必須拒絕：

- 非 Owner 呼叫；
- 指派 `owner`；
- 變更 Owner 帳號；
- 會員自行修改角色；
- 不存在或未完成會員資料的目標；
- 不在正式角色集合內的值。

## 4. Owner 操作介面

會員管理頁新增：

- 角色欄：Owner（最高管理者）、Partner（合作人）、Helper（小幫手）、Member（會員）；
- 非 Owner 會員的「變更角色」操作；
- 顯示目標、目前角色、新角色與重新登入影響的確認視窗；
- 二次確認後才能送出；
- 成功後刷新列表並回饋稽核紀錄已建立；
- Owner 帳號沒有可編輯角色控制項。

## 5. 安全與資料邊界

- Client SDK 不能直接寫入角色或 Audit Log；角色變更與 Audit Log 一律由 Server／Admin SDK 執行。
- Owner Claim 是唯一 Owner 權限來源；不依 Email 判斷。
- 本批不增加使 Partner／Helper 可讀取付款、退款、會員私密資料、對帳或角色管理資料的 API。
- 不更新會員本身的角色欄位作為權威來源，避免與 Firebase Claim 不一致。
- Audit Log 只能追加、不可由任何前端修改。

## 6. 已確認的下一批規格（本批不實作）

### Partner 工作流

- Partner 可管理商品、Variant、Campaign、分類與品牌內容，但所有新建、修改、封存或停售都先形成草稿／待審修改；Owner 核准後才影響公開版本與 `productsPublic`。
- Partner 修改已公開商品時，公開版本維持原狀，直到 Owner 核准待審版本。
- 駁回時保留草稿與駁回理由；Partner 可修正後再次送審。
- Partner 可查看全部草稿，但只能修改自己建立的草稿；Owner 可查看、修改與核准全部。
- Partner 可唯讀查看商品、Campaign、內容與成本相關 Audit Log；不可查看付款、退款、會員私密資料、角色異動等紀錄。
- Partner 對訂單資料僅看業務必要資訊；姓名、電話與地址完全遮罩。付款回報僅見訂單編號、金額、日期與狀態，帳戶資訊與匯款人遮罩。

### 搶購、成本、Helper 分紅與 Owner／Partner 分潤（未來獨立功能）

- Owner、Partner、Helper 都可參與搶購並登錄自己的成功數量與實際成本。
- 「Helper 分紅」只給 Helper，依核准後的實際 TWD 成本、商品分紅比例及成功數量計算；Owner、Partner 參與搶購時不取得 Helper 分紅。
- 「Owner／Partner 分潤」是商品收入扣除成本、Helper 分紅、國際運費、關稅與雜費後的淨額分配，與 Helper 分紅是不同概念。
- Helper 自己提交的成本可由 Partner 或 Owner 核准；Partner 不得核准自己填寫或屬於自己的成本。Owner 可直接確認任何成本，但必須二次確認並建立不可修改的 Audit Log。
- 採購時的角色、成本、數量、Helper 分紅比例及分潤參與者均保存歷史快照，日後角色或商品設定變更不回寫歷史。
- 完整規格以 `2026-08-13-roles-rush-bonus-settlement-design.md` 為準。

## 7. 驗收與測試

本批至少涵蓋：

- Unit：角色解析、角色層級、輸入驗證、禁止變更 Owner、角色異動稽核資料。
- API：Owner 成功指派、非 Owner／自我異動／Owner 目標／無效角色／未完成資料會員全部拒絕；呼叫後目標 Token 被撤銷。
- Rules：Client SDK 不可直接寫入業務角色或 Audit Log。
- Playwright：Owner 變更角色、二次確認、目標重新登入後看到一次通知；Partner／Helper／Member 均不能取得 Owner API 權限。
- 回歸：TypeScript、ESLint、Unit、Rules、Build 與相關 Playwright。

## 8. 明確排除

- 從網站授予、移除或轉移 Owner；
- Partner／Helper 付款確認、付款撤銷、退款、銀行 Excel 對帳、收款帳戶管理、角色管理、會員私密備註；
- 任何 Client 直接寫入 Firestore 業務資料；
- 為本批新增 ERP、Finance、Warehouse、CRM 或 Analytics。
