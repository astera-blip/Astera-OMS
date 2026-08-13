# Astera OMS 角色、搶購成本、Helper 分紅與多 Partner 分潤設計

日期：2026-08-13
狀態：設計已確認，待使用者審閱書面規格後建立分階段實作計畫

## 1. 目標

在不推翻現有 Product、Variant、Campaign、Checkout、Order、Payment、Cancellation 與公開商品架構的前提下，延伸 Astera OMS，使內部人員能安全地完成：

1. Owner 指派 Partner、Helper 與 Member；
2. Partner 提交商品與內容草稿，Owner 審核後才影響正式資料；
3. Owner、Partner、Helper 登記搶購結果及實際成本；
4. 系統計算並追蹤 Helper 分紅；
5. 依 Product＋Campaign 結算 Owner 與一位或多位 Partner 的分潤或虧損；
6. 透過共用分帳中心查詢個人應收、已收、應扣回及歷史調整。

本設計建立的是商品級內部分帳，不擴充為完整 ERP、會計總帳、Wallet、CRM、Warehouse、Finance 或 Analytics 系統。

## 2. 固定名詞

### 2.1 Helper 分紅

Helper 分紅是提供給 Helper 的搶購成果報酬。Owner 與 Partner 即使參與同一場搶購，也不取得 Helper 分紅。

### 2.2 Owner／Partner 分潤

分潤是商品完成收支計算後，由 Owner 與被指派至該 Product＋Campaign 的一位或多位 Partner 分配淨利或共同承擔虧損。

Helper 分紅是交易支出，必須先從收入扣除，再計算 Owner／Partner 分潤。

### 2.3 結算單位

正式結算以 `Product＋Campaign` 為最小單位：

- 同一 Product 下的 Variant 合併於該 Product＋Campaign 結算；
- 同一 Product 參加不同 Campaign 時分開結算；
- Campaign 彙總只作查詢與報表，不得混寫各 Product 的正式結算；
- 結算快照保存 Product、Campaign、Variant、參與者、角色、比例及金額的當時值。

## 3. 角色與正式權限來源

正式角色由高至低為：

```text
owner > partner > helper > member
```

Firebase Custom Claim 是唯一正式角色來源，不得使用 Email 或可由 Client 修改的 Firestore 欄位判斷角色。

### 3.1 Owner（最高管理者）

- 擁有 Partner 與 Helper 的全部低風險作業能力；
- 指派 Partner、Helper、Member；
- 網站不得授予、移除或轉移 Owner；
- 直接建立、修改、刊登與封存商品、Campaign、分類及品牌內容；
- 輸入並確認任何成本與費用；
- 管理 Product＋Campaign 的分潤參與者及特殊比例；
- 核准或駁回 Partner 草稿與成本；
- 執行正式結算、付款／分紅狀態更正及結算後調整；
- 保留付款確認、付款撤銷、退款、銀行 Excel 對帳、會員私密資料與角色管理等高風險能力。

### 3.2 Partner（合作人）

- 建立或修改商品、Variant、Campaign、分類與品牌內容草稿；
- 提議 Helper 分紅比例、特殊 Owner／Partner 分潤比例及二補金額；
- Owner 核准前，草稿不得影響正式商品、會員應付款或 `productsPublic`；
- 登記自己的搶購結果與實際成本；
- 輸入 Product＋Campaign 的國際運費、關稅與雜費；
- 核准 Helper 自己提交的成本，但不得核准自己填寫或屬於自己的成本；
- 查看商品必要的訂單與付款摘要，所有會員姓名、電話、地址、銀行帳戶、退款帳號及匯款人資料遮罩；
- 查看商品、Campaign、內容、成本、分紅與分潤相關 Audit Log；
- 不得執行付款確認／撤銷、退款、Excel 對帳認列、收款帳戶管理、會員私密備註或角色管理。

Partner 可查看全部搶購任務、各 Helper 的成功數量與成本狀態以協作，但只能修改自己建立的任務；不可修改其他 Partner 建立的任務，亦不可核准自己填寫或代填的成本。

### 3.3 Helper（小幫手）

- 查看被指派或自己參與的搶購任務；
- 登記自己的成功數量及實際 TWD 成本；
- 查看自己的成本核准、Helper 分紅、發放及更正歷史；
- 可將自己的分紅標記為「已收款」；
- 不得查看其他人成本、公司收入、Owner／Partner 分潤、會員資料或一般 Workspace 資料；
- 不得核准任何成本。

### 3.4 Member（會員）

維持既有會員資料、商品、購物車、Checkout、訂單、付款回報、取消與退款申請能力，不可讀取任何內部分帳資料。

## 4. 角色指派與生效

角色指派沿用 `2026-08-13-role-assignment-design.md`：

- 只有 Owner 可將既有非 Owner 會員切換為 Partner、Helper 或 Member；
- API 以 Owner Claim 驗證，不接受指派 `owner`；
- 角色變更寫入不可修改 Audit Log；
- 變更後撤銷目標帳號 Refresh Token，重新登入才取得新 Claim；
- 歷史採購、成本、分紅與分潤使用發生時角色快照，不因日後角色變更而改寫。
- Owner 將 Partner 或 Helper 降回 Member 後，內部 Workspace 權限立即撤銷；尚未完成的搶購任務標記為「需重新指派」，不自動刪除；未結算案件的分潤資格保留到 Owner 在結算前明確移除為止。

## 5. Partner 草稿與審核

Partner 對下列資料的操作先形成 `catalogChangeRequests`：

- Product；
- Variant；
- Campaign；
- Company、Artist、CP、Brand、Series 分類；
- 品牌介紹、FAQ、公告、社群與 Footer 內容；
- Helper 分紅比例；
- 特殊分潤比例；
- 正式二補金額與說明；
- 封存或停售請求。

規則：

- Partner 可查看全部草稿，但只能修改自己建立的草稿；
- Owner 可查看、修改、核准或駁回全部草稿；
- Partner 修改已公開商品時，原公開版本維持不變；
- Owner 核准後，Server 才套用正式資料並重新生成 `productsPublic`；
- 駁回保留草稿、原因與版本，Partner 可修正後再次送審；
- 二補草稿只有 Owner 核准後才能建立或更新正式會員付款請求與通知。
- Partner 可以使用受保護的內部預覽查看自己的草稿商品頁與價格；預覽不寫入 `productsPublic`、不會出現在前台或搜尋、不能加入購物車或建立訂單。
- 開放中的 Campaign 即使是價格、結單時間或二補規則修改，也必須維持原公開版本，直到 Owner 核准草稿後才套用。

## 6. 成本輸入與核准矩陣

| 情境 | 輸入後狀態 | 正式核准者 |
| --- | --- | --- |
| Owner 輸入自己的成本 | 直接正式 | Owner 二次確認並寫 Audit Log |
| Owner 代任何人輸入成本 | 直接正式 | Owner 二次確認並寫 Audit Log |
| Partner 輸入自己的成本 | 待核准 | 只能由 Owner 核准 |
| Helper 輸入自己的成本 | 待核准 | Partner 或 Owner |
| Partner 代 Helper 輸入成本 | 待核准 | 不得由原輸入者核准；由其他 Partner 或 Owner核准 |

硬性規則：

- Partner 與 Helper 不能核准自己填寫、且屬於自己的成本；
- Helper 不能核准任何成本；
- Owner 是自我核准限制的明確例外；
- Owner 例外必須二次確認，記錄操作者、時間、原值、新值及原因；
- 成本核准後保存人員、角色、單價、幣別、換算後 TWD、成功數量及核准者快照；
- 成本送審後、核准前，原輸入者可以修正或撤回；核准後只能提出更正申請；Partner 可核准或駁回 Helper 的更正申請，Owner 可直接以原因更正；分紅已支付或已鎖定結算時一律新增更正／調整事件；
- Helper 分紅一律以核准後的實際 TWD 成本計算；
- 正式結算後不得修改原成本，只能新增結算調整。

## 7. Helper 分紅

### 7.1 計算公式

```text
Helper 分紅
= 核准後單件實際成本（TWD）
× 該筆採購保存的 Helper 分紅比例
× 核准成功數量
```

- 分紅比例依 Product 設定，可變動；
- Partner 可在商品草稿中提議比例，Owner 核准後生效；Owner 可直接設定；
- `purchaseContributions` 保存使用中的比例快照，日後比例修改不回寫；
- 分紅使用整數 TWD；以整數 basis points 計算後四捨五入至整數；
- Owner 與 Partner 的採購紀錄不產生 Helper 分紅。

### 7.2 成立與發放

- Helper 的成功數量與實際 TWD 成本完成核准後，分紅立即成立為「待支付」；
- 不必等待 Product＋Campaign 正式結算；
- 後續會員取消、退款或整體商品虧損，不追回已成立的 Helper 分紅；
- Owner 或 Partner 可將「待支付」標記為「已支付」；當事 Helper 可標記「已收款」；兩者都完成時才顯示「已完成」；
- 系統為支付與收款各自建立不可修改事件，保存日期、金額、操作者 UID 與當時角色；
- 任一方確認後不得復原；只有 Owner 可建立有原因的更正事件；
- 原發放事件永遠保留，不覆寫或刪除。

## 8. 收入、支出與分潤公式

### 8.1 收入

```text
收入
= 已認列商品售價
+ 已認列二補金額
```

- 商品售價由 OrderItem 成立時保存的 Server 權威價格快照及正式付款認列結果計算；
- 二補收入只來自正式二補 PaymentRequest 與已確認、未撤銷的 Payment／Allocation；
- 未付款、已取消、已拒絕、已撤銷或已退款金額不列為收入；
- 前端送來的價格、收入合計或付款狀態一律不採信。

### 8.2 支出

```text
支出
= 已核准實際商品成本
+ Helper 分紅
+ 國際運費
+ 關稅
+ 雜費
```

- Owner 與 Partner 都可輸入國際運費、關稅及雜費的 Product＋Campaign TWD 分攤金額；
- 上述營運費用不需額外核准，但必須保存操作者、時間、分類、金額、備註及前後差異；
- 正式結算前，原輸入者可修改或刪除自己的費用；其他 Partner 只能查看；Owner 可修改或刪除任何人的費用，且必須保存原值、原因與 Audit Log；
- 已鎖定結算後的新費用只能建立補充調整。

### 8.3 可分潤淨額

```text
可分潤淨額 = 收入 - 支出
```

淨額為負數時不歸零，Owner 與所有參與 Partner 依鎖定比例共同承擔虧損。

## 9. 多 Partner 分潤

### 9.1 參與者與預設比例

每個 Product＋Campaign 可有零位或多位 Partner。只有 Owner 可以新增或移除正式分潤參與者。

預設採 Owner 與所有參與 Partner 平均分配：

| 參與者 | 預設比例 |
| --- | --- |
| Owner、沒有 Partner | Owner 100% |
| Owner＋1 Partner | 50%／50% |
| Owner＋2 Partners | 約 33.34%／33.33%／33.33% |
| Owner＋3 Partners | 25%／25%／25%／25% |

- 比例使用 basis points，合計必須為 `10000`；
- 平均分配除不盡的比例尾差歸 Owner；
- 未加入該 Product＋Campaign 的其他 Partner 不參與分潤；
- Owner 可設定特殊比例；Partner 可提出比例草稿，但須 Owner 核准；
- 正式結算前新增或移除 Partner，系統立即重算全體預估比例與分潤；
- 正式結算後，參與者與比例完全鎖定；新 Partner 只適用於尚未結算或未來的 Campaign；
- 結算後退款或補充費用仍沿用原結算快照的參與者及比例。

### 9.2 金額整數與尾差

- 所有資料庫金額只保存整數 TWD；
- 所有百分比計算使用整數 basis points，不使用浮點數作正式帳務；
- 各 Partner 的分潤依其比例四捨五入至整數；負數以絕對值四捨五入後恢復負號，等同 midpoint away from zero；
- Owner 取得淨額扣除所有 Partner 金額後的剩餘值；
- 正數與負數使用同一規則，兩者合計必須精確等於可分潤淨額；
- 快照保存計算基數、比例、四捨五入結果與 Owner 尾差。

例：淨額 NT$101，Owner 與一位 Partner 各 50%：Partner 為 NT$51，Owner 為 NT$50。

## 10. 正式結算、虧損與結算後調整

### 10.1 結算 Gate

只有 Owner 可以正式結算。Server 必須確認：

- Campaign 已結束；
- 所有相關 OrderItem 已完成付款、取消或退款狀態處理；
- 商品款及二補沒有待付款、待確認、待撤銷或待退款項目；
- 成本與成功數量已完成必要核准；
- 參與 Partner 已設定，或 Owner 明確設定該案為 Owner 100%；
- 所有比例合計為 100%；
- 相關資料未被另一個結算交易鎖定。

Helper 分紅可以尚未實際發放，但其成立金額必須已確定並列入支出。

### 10.2 鎖定與不可變性

正式結算在 Firestore Transaction 中建立不可修改快照，包括：

- Product、Campaign 與 Variant 快照；
- 收入明細與來源 ID；
- 成本、Helper 分紅及費用明細；
- Owner 與 Partner 參與者、角色與比例；
- 淨額、個別分潤、負數餘額及四捨五入資料；
- 結算 Owner、時間及版本。

正式快照不得覆寫、刪除或重新計算。

### 10.3 結算後調整與跨商品抵扣

結算後若發生退款、新費用或更正：

- 不修改原結算；
- 建立不可修改的正向或負向 `settlementAdjustments`；
- 沿用原結算參與者與比例計算每人差額；
- 負數餘額帶入個人跨商品累積餘額，從未來分潤中依序扣回，直到歸零；
- 每次抵扣保存來源結算、目標結算、金額、時間及 Audit Log；
- Helper 已成立的分紅不因結算後退款而追回。

## 11. 分潤與提領狀態

### Partner

- Owner 可標記「已支付」；Partner 可標記自己的分潤「已收款」；兩者都完成時才顯示「已完成」；
- 系統為支付與收款各自建立不可修改事件；
- 確認後只有 Owner 可新增更正事件，且必須填理由。

### Owner

- Owner 查看自己的未提領與已提領金額；
- 只有 Owner 可標記自己的分潤「已提領」；
- 系統保存提領時間、金額與操作者；
- 更正同樣使用追加事件，不覆寫原紀錄。

## 12. 資料模型延伸

既有 Collection 名稱、文件 ID 與業務流程維持不變。新增內部 Collection：

| Collection | 用途 |
| --- | --- |
| `catalogChangeRequests` | Partner 商品、Campaign、分類、內容、比例與二補草稿及審核歷史 |
| `purchaseContributions` | 搶購結果、數量、實際成本、核准及角色／比例快照 |
| `settlementExpenses` | Product＋Campaign 的國際運費、關稅與雜費 |
| `productSettlements` | 結算前參與者設定、阻塞狀態及 Owner 鎖定的正式快照 |
| `settlementAdjustments` | 結算後退款、新費用、更正及跨商品抵扣 |
| `settlementPayoutEvents` | Helper 分紅、Partner 分潤、Owner 提領及更正事件 |

既有 `auditLogs` 繼續保存安全稽核，不另建第二套 Audit Log。

`productsInternal` 延伸保存 Helper 分紅比例及預設平均分配政策。正式參與者與個別比例屬於 Product＋Campaign 結算設定，不放在 `productsPublic`。

`productsPublic` 仍是前台唯一商品來源，且不得包含：

- Product／Variant SKU；
- 成本；
- 內部備註；
- Helper 分紅比例或金額；
- Owner／Partner 名單、比例、分潤或餘額；
- 任何會員或內部人員識別資料。

## 13. Server 權威資料流

```text
前端送出操作意圖與 Firebase ID token
→ Server 驗證 Custom Claim 與撤銷狀態
→ Server 讀取權威商品、訂單、付款、取消、成本與結算資料
→ Server 驗證操作人、受益人、核准者及狀態
→ Server 以整數重新計算所有金額
→ Firestore Transaction 與冪等鍵寫入
→ 追加 Audit Log
→ 回傳依角色過濾的 View Model
```

前端不得決定或寫入：

- 最終收入、支出、分紅、分潤或餘額；
- 自己或他人的角色；
- 核准資格；
- 是否符合正式結算 Gate；
- 結算、發放、提領或更正時間；
- Audit Log 或歷史快照。

## 14. Workspace 資訊架構

### `/workspace/members`

- Owner 指派 Partner、Helper、Member；
- 網站不提供 Owner 授予、移除或轉移。

### `/workspace/products`

- Owner 直接管理商品與內部設定；
- Partner 建立草稿；
- Helper 無入口。

### `/workspace/catalog-reviews`

- Owner 審核 Partner 草稿；
- Partner 查看全部草稿並編輯自己的草稿。

### `/workspace/rush-purchases`

- Owner 與 Partner 可直接建立並指派搶購任務給指定 Helper，不需 Owner 逐筆核准；系統保存建立者、指派對象、時間與內容 Audit Log；
- Owner、Partner、Helper 登記自己的搶購成功數量與成本；
- Partner 只能修改自己建立的任務；Owner 可修改或取消所有 Partner 任務；
- 顯示成本核准、Helper 分紅與發放狀態；
- API 依角色過濾可見人員與欄位。

### `/workspace/settlements`

共用「分帳中心」，可依 Product、Campaign、人員、日期與狀態查詢：

- Owner：全部商品收入、支出、Helper 分紅、所有參與者分潤、虧損、抵扣、發放、提領、正式結算與更正；
- Partner：完整 Product＋Campaign 收支與各參與者在該案的分配，及自己的跨商品累積餘額；不得查看 Owner 的跨商品全域餘額；
- Helper：自己的採購、核准成本、分紅、發放及更正歷史；不得查看公司淨利或他人資料。

### `/workspace/audit-logs`

- Owner：完整稽核；
- Partner：商品、Campaign、內容、成本、Helper 分紅與商品分潤相關紀錄；
- Helper：自己的提交、核准結果與分紅發放紀錄。

### 既有頁面整合

- Workspace 首頁依角色顯示待審草稿、待核准成本、待支付分紅、待結算與結算阻塞事項；
- 訂單／付款頁顯示收入是否已認列；
- 取消／退款頁標示受影響的 Product＋Campaign 結算；
- 導覽只顯示角色有權使用的入口；
- Partner 的訂單／付款摘要使用 Server 遮罩後資料，不把私密資料傳至 Client。

## 15. 安全、錯誤與競態防護

Server 必須拒絕：

- 重複加入同一 Partner；
- 加入不是有效 Partner Claim 的帳號；
- 非 Owner 修改正式參與者；
- 比例小於 0 或合計不等於 100%；
- Partner／Helper 自我核准；
- Helper 核准任何成本；
- 非 Owner 正式結算或更正；
- 修改已鎖定結算或歷史事件；
- 結算前置條件未完成；
- 前端偽造收入、成本、比例、角色或狀態；
- 未授權角色讀取完整分帳或他人資料。

所有高風險寫入採 Firestore Transaction、穩定冪等鍵及不可修改事件。重複送出回傳原結果；相同冪等鍵搭配不同內容回傳衝突。交易競態時不建立重複結算、發放或調整。

錯誤訊息使用可理解中文，指出阻塞類型，例如「尚有二補待確認」或「成本仍待核准」，但不得洩漏會員、銀行帳戶或其他角色的私密資料。

Firestore Rules 對新增業務 Collection 的 Client 寫入全部拒絕；讀取也以受保護 Server API 為主，避免 Client 取得未遮罩資料。

## 16. 現有資料遷移

- 既有 Product 的 Helper 分紅比例預設為 0%，不自動產生歷史分紅；
- 既有未結算 Product＋Campaign 標記為「尚未設定分帳參與者」；Owner 完成設定前不得正式結算；
- 不自動回溯計算舊訂單的 Helper 分紅或 Partner 分潤；
- 既有 Order、OrderItem、Payment、PaymentRequest、Allocation、Cancellation 與 Audit Log 不搬移、不改 ID；
- 舊 Google Sheet 不自動匯入正式帳務；若需匯入，另設具 dry-run、欄位核對與明確 Production confirmation 的 migration；
- 遷移先執行唯讀 dry-run，報告受影響 Product、Campaign、缺少成本與缺少參與者數量，不輸出會員私密資料。

## 17. 分階段交付

本設計必須拆成四個獨立計畫與發布批次：

1. 角色指派、Custom Claim、Token 撤銷及權限防護；
2. Partner 商品／Campaign／內容草稿與 Owner 審核；
3. 搶購紀錄、成本核准及 Helper 分紅；
4. 分帳中心、多 Partner 分潤、正式結算、調整與跨商品餘額。

每批均先完成 Unit、API、Rules、Build 與 Playwright，再部署 Preview 驗收。未完成的後續批次不得以半成品入口部署 Production。

## 18. 測試矩陣

### Unit

- 角色解析與能力矩陣；
- 成本核准矩陣與 Owner 例外；
- Helper 分紅、整數四捨五入與比例快照；
- 多 Partner 平均比例、特殊比例、加入／移除重算與比例尾差；
- 正數、虧損、Owner 金額尾差、結算後調整及跨商品抵扣；
- 結算 Gate 與不可變狀態轉換。

### API

- Owner、兩位 Partner、兩位 Helper、Member 的每項允許與拒絕路徑；
- Client 偽造角色、金額、核准者、參與者及狀態全部拒絕；
- 自我核准、重複 Partner、無效比例、已鎖定修改與未完成結算全部拒絕；
- 冪等重播回傳一致結果；不同內容衝突不產生第二筆資料；
- 同時核准、發放或結算只允許一筆交易成功。

### Firestore Rules

- Client SDK 無法直接寫入任何新增業務 Collection；
- Member、Helper、Partner 不可跨權限讀取；
- 私密會員、付款、銀行及退款資料維持拒絕；
- `productsPublic` 匿名已發布商品讀取不受影響。

### Playwright

- Owner 指派角色與目標重新登入；
- Partner 草稿、Owner 駁回／核准及公開 projection 更新；
- Helper 成本送審、Partner／Owner 核准及分紅成立；
- 分紅發放、Owner 更正、特殊比例、多 Partner 重算；
- 正式結算阻塞、成功鎖定、退款後負向調整及未來分潤抵扣；
- 390px／Pixel 7 與桌機 Workspace 導覽、欄位遮罩及跨角色拒絕。

### 全套回歸

- TypeScript；
- ESLint；
- Unit；
- Firestore／Storage Rules；
- Build；
- 一般與 Emulator Playwright；
- secret scan；
- production audit。

## 19. 完成條件

- 角色能力與 Custom Claim 權限一致；
- Partner 草稿不會在 Owner 核准前影響正式商品或會員金額；
- 成本自我核准限制與 Owner 例外均可稽核；
- Helper 分紅、Owner／多 Partner 分潤、虧損與整數尾差可被重算；
- 正式結算及歷史事件不可覆寫；
- 結算後退款與新費用只建立調整並正確跨商品抵扣；
- Owner、Partner、Helper 只能看到自己權限範圍內資料；
- 前台 `productsPublic`、Checkout、Order 與 Payment 商業語意不被破壞；
- 所有自動化驗證全綠，文件、執行計畫、交接、Test Plan、Deployment SOP 與 Changelog 同步更新。

## 20. 明確排除

- 從網站授予、移除或轉移 Owner；
- Partner／Helper 確認付款、撤銷付款、核准退款或執行銀行 Excel 對帳；
- 讓 Partner／Helper 讀取會員完整個資、銀行帳戶或退款帳號；
- Client SDK 直接寫入角色、草稿、成本、分紅、分潤、結算、調整或 Audit Log；
- 將 Helper 分紅與 Owner／Partner 分潤混為同一欄位或同一公式；
- 結算後覆寫原快照；
- 自動將舊 Google Sheet 或舊訂單轉成正式分帳；
- 建立完整會計總帳、Wallet、Warehouse、CRM、Finance 或 Analytics 模組。
