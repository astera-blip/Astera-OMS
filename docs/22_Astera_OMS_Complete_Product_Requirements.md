# Astera OMS 完整產品需求總書

> 版本：v1.0 整合版  
> 日期：2026-07-31  
> 文件狀態：已確認的完整產品藍圖；功能依階段逐步實作  
> 產品：Astera OMS

## 0. 文件定位與權威順序

本文件整合 `docs/21_Astera_OMS_MVP_PRD.md`、第二份 Astera PRD、完整 AI 交接資料及本次需求釐清結果。它描述 Astera 目前能規劃的最完整產品，不代表所有功能都必須在首次上線完成。

需求衝突時，依以下順序處理：

1. 使用者最新明確確認的決策。
2. 本文件標示「已確認」的規則。
3. `docs/20_CompleteAIHandoff_2026-07-30.md` 的目前程式真實狀態。
4. 既有 PRD 中未被覆蓋的內容。
5. 「建議方案」及「待確認」內容不可由工程自行定案。

每項功能同時標示兩個維度：

- **階段**：已完成／現況、首次正式上線 MVP、V1 擴充、V2／長期規劃。
- **決策狀態**：已確認、建議方案、待確認、需外部確認。

## 1. 產品定位與目標

Astera 是面向台灣消費者的泰國 GL、藝人及收藏周邊代購平台與 OMS。核心價值是讓會員清楚知道可以買什麼、何時結單、是否需要付款或二補，以及訂單目前進度。

完整藍圖包含：會員電商、OMS 訂單生命週期、PIM 商品管理、CRM 會員風險、ERP／Finance 金流與分潤，以及以待辦為中心的營運 Workspace。

首次版本只支援台灣境內服務與銀行匯款。海外配送、信用卡、Stripe、LINE Pay、超商代碼、LINE Login 及 SMS Login 不在首次版本承諾範圍。

## 2. 使用者與權限

### 2.1 角色

| 角色 | 權限摘要 |
| --- | --- |
| 訪客 | 只能查看已公開商品與已公開販售活動；不可結帳、查看會員資料或後台內容。 |
| Member | Google 登入、維護自己的資料、瀏覽、購買、付款回報、查看自己的訂單、候補、通知、餘額及取消申請。 |
| Owner | 最高權限；管理商品、販售活動、分類、訂單、付款、退款、會員、財務、內容、角色、設定及稽核。 |
| Partner | 可處理被授權的日常營運工作及查看自己的分潤；不自動擁有 Owner 權限。 |
| Helper | 只查看被指派的搶購／採購任務及自己的分紅，不查看其他人的敏感資料。 |

### 2.2 Member Profile

首次 Google 登入後必須補齊：姓、名、社群內 ID、台灣手機號碼。生日選填；Google 頭像可沿用。地址、收件資料及配送方式在會員中心或結帳時維護。

手機資料需正規化後儲存及比對。重複電話不直接阻擋註冊，但後台顯示警示並保留未來會員合併能力。

### 2.3 Partner 與 Helper

Partner 可查看及處理被授權的商品、Campaign、訂單、採購、到貨、配貨、出貨及會員服務工作。Partner 不可修改信用額度、角色及權限，不可任意查看完整黑名單原因、非必要個資、完整財務匯出或高風險退款。

Helper 只看到任務編號、商品、規格、數量、期限及遮罩後識別資訊。Helper 可以回報搶購結果、數量、金額及附件，也可以查看自己的任務分紅、計算方式、狀態及發放紀錄，但不可查看其他人的分潤、完整會員資料、付款資料或公司完整成本。

### 2.4 Partner 商品草稿審核（已實作）

- Partner 可讀取正式 Product／Variant／Campaign 與分類主檔，作為建立變更草稿的基礎；不可直接寫入正式商品或分類。
- Partner 每次送審必須填寫草稿標題與變更原因。草稿只寫入 `catalogChangeRequests`，核准前不得更新 `productsInternal`、`productVariants`、`saleCampaigns` 或 `productsPublic`。
- Owner 可駁回並填寫原因；建立者可載入被駁回草稿、修正後提高 revision 再次送審。Partner 不可修改其他 Partner 的草稿。
- 草稿必須保存建立者載入時的正式商品版本；送審、重送或核准時若正式商品已變更，Server 必須拒絕並要求重新載入，不得以過期內容覆蓋正式資料。每次被駁回後的修訂保留不可變 revision snapshot。
- Partner 輸入必須在 Server 嚴格驗證資料型別、狀態、幣別、成本、Default Variant 與子項目 ID 唯一性。Partner 不可修改圖片；新 Product／Variant／Campaign ID 及 SKU 由 Server 派發，封存 ID 不得重用。
- 分類 ID 與顯示名稱以 active 分類主檔為權威；送審後若分類改名或封存，核准必須回傳衝突，不得靜默套用 Owner 未看見的內容。Owner 審核畫面必須列出核准後將封存的既有 Variant／Campaign。
- Owner 核准時，正式 Product、Variant、Campaign、公開 projection、審核狀態及 Audit Log 必須在同一 Firestore transaction 完成。完全相同的重複審核保持冪等，變更 decision 或 reason 的 replay 必須拒絕。
- 封存 Variant 後保留 SKU 與原幣成本歷史；新 Variant 繼續往後編號，不得補用封存號碼。
- `catalogChangeRequests` 對匿名、Member、Helper、Partner、Owner 的 Client SDK 均拒絕讀寫；畫面只透過驗證 Firebase ID token 與 custom claim 的 Server API 存取。
- Partner Workspace 僅提供商品與草稿審核；會員、訂單、付款、品牌內容與 Audit Log 等非授權路徑，即使直接輸入網址也必須拒絕。

## 3. 訪客、會員與公開內容

訪客的產品權限只有：

- 已刊登的公開商品。
- 已公開的販售活動。

訪客不能結帳。Terms／Privacy 不列為訪客可自由瀏覽的內容，而是在會員註冊或交易流程中提供必要連結與同意。

會員登入後可查看 Owner 已發布的網站內容：品牌介紹、FAQ、購買流程、付款、取消退款、配送說明、公告、客服及社群連結。未設定的資訊不得產生假連結或「暫不提供」的低信任文案。

## 4. Product、Variant、分類與 Series

### 4.1 Product

Product 代表商品本體，包含名稱、公開描述、內部備註、圖片、刊登狀態及關聯資料。狀態為 Draft、Published、Archived。Product ID／SKU 由 Server 派發，正常 UI 不可修改。

### 4.2 Variant

所有商品都建立 Variant；無規格商品使用 Default Variant。Variant 可表示尺寸、顏色、版本、套組或其他選項，保存原幣成本、原幣別及預設售價。原幣別預設 THB，可選 TWD、JPY、KRW、USD。封存 Variant 不補號；已被 OrderItem 使用的 SKU 不可改寫。

### 4.3 分類關聯

Product 可同時關聯多個 Company、Artist、CP、Brand 及 Series。關聯可新增、解除或封存；後續關係及名稱變更不得回寫歷史訂單快照。

分類主檔由 Owner 管理，分類 ID 由 Server 建立。分類可改名及封存，不可硬刪；必須拒絕空白及重複名稱。

### 4.4 Series

Series 是內容或企劃上的商品系列，例如 KS Hotel。Series 可以留空；單獨推出的帽子或其他商品不需要硬塞入系列。

## 5. Campaign（販售活動）

Campaign 在 Astera 代表一次實際販售活動，不是廣告投放。它保存本次販售類型、活動價格、開始／結束時間、付款期限、公開提醒、二補規則及狀態。

商品可以先獨立建立及展示，但要正式販售就必須關聯有效 Campaign。沒有系列的單品由系統自動建立單品活動，例如 `藝人官方帽子｜預購｜2026-08`，Owner 可修改名稱。

販售類型先包含：

- In Stock（現貨）。
- Preorder（一般預購）。
- Rush Purchase（搶購）。
- Waitlist（候補）。

Campaign 狀態為 Upcoming、Open、Closed、Archived。Campaign 價格優先於 Variant Default Price。Archived Campaign 不得進入公開商品投影。

## 6. 販售流程

### 6.1 一般預購

會員結帳後立即建立正式 Order 及 Payment Request，於 Campaign 結單前付款，再進入採購、到貨、配貨、二補及出貨流程。

### 6.2 搶購

會員先登記需求，系統建立暫定 Order 及訂單編號，但不建立 Payment Request。Owner／Helper 回報實際結果後：

- 全部搶到：轉為待付款。
- 部分搶到：以實際數量成立，未取得數量標示失敗，會員只支付成功部分。
- 完全沒搶到：轉為搶購失敗／未成立。

### 6.3 候補

會員先登記，不付款。候補順序以最初登記時間為準。有名額時依序分配；取得資格後建立付款要求，預設保留 24 小時，Owner 可個別調整。逾期資格失效，名額可交給下一位。

### 6.4 購物車與拆單

購物車可混合不同商品、販售類型及 Campaign。會員只結帳一次，系統依 Campaign 建立多張 Order，使用同一個 `checkoutGroupId` 關聯。每張 Order 保存自己的活動、價格、期限、付款要求及狀態。

## 7. Order 與 OrderItem

Order 是一次結帳的容器；OrderItem 是實際履約生命週期核心。同一張 Order 內的商品可以有不同採購、到貨、配貨、退款、二補及出貨進度。

建立訂單時保存商品名稱、Variant、規格、單價、幣別、必要匯率、Campaign、分類名稱及同意版本快照。商品或活動日後改名、改價或改關聯，不得回寫歷史訂單。

Guest Order 由 Owner 代未註冊客戶建立，不能公開匿名結帳；會員日後用 Google 註冊後可由 Owner 綁定，綁定保存原資料、操作者、時間及 Audit Log。

## 8. 付款、退款、餘額與信用

### 8.1 付款回報

會員從自己的有效未付款 Payment Request 清單勾選一筆或多筆訂單。每筆顯示訂單編號、商品／Campaign、應付、已付、尚欠及付款期限。會員輸入匯款日期、金額、帳號末五碼、匯款人姓名；備註與截圖選填。

會員可自行分配本次匯款到各訂單，例如：

```text
KS Hotel：NT$3,700
AW Ling Birthday：NT$1,300
本次匯款：NT$5,000
```

分配總額不得超過實際匯款金額。系統建立 Payment 及預計 Payment Allocation；Owner 確認後才正式更新訂單及應收狀態。一筆 Payment 可分配多張 Order，一張 Order 可由多筆 Payment 完成。

付款期限：現貨下單後 1 小時；一般預購至 Campaign 結單；搶購確認成功後由 Owner 個案設定；候補取得資格後預設 24 小時。

### 8.2 多匯與少匯

多匯時會員可選擇保留為 Wallet 餘額或退回原匯款帳戶。Wallet 可折抵未來商品、二補及 Astera 應收款，原則上不可自行提領；特殊情況由 Owner 審核。所有 Wallet 異動使用 Wallet Ledger。

少匯時一般要求補足；低於後台設定的小額門檻時，Owner 可決定併入二補或吸收。例外必須記錄原因、操作者、時間及金額。

### 8.3 取消與退款

未付款 OrderItem 可直接取消並重算 Order／Payment Request。已付款 OrderItem 必須提出取消申請，Owner 審核時填退款日期、金額、方式及參考資料。退款可退回原匯款帳戶或轉入 Wallet。原 Payment 永久保留，退款另建 Refund、Adjustment 及 Audit Log。

### 8.4 信用額度

信用額度只提供少數 Owner 核准會員。建立信用訂單立即占用；取消未付款立即釋放；支援部分付款加部分信用；超額需 Owner 核准單次例外；Payment Allocation 確認後依實際收款釋放占用。

## 9. 採購、到貨、配貨、二補與出貨

每次採購建立 Purchase，保存日期、Product／Variant、數量、原幣金額、匯率、採購人、官方訂單號、付款及附件。商品可分批到台灣，每批建立 Arrival Batch。OrderItem 可分配到不同到貨批次。

需求大於實際取得數量時，系統產生 Allocation Preview；Owner 確認後才正式配貨。缺貨可部分成立、候補、取消或退款；不可超額配貨或出貨。

商品到台灣、費用確認及賣場建立完成後，Owner 正式發送二補通知，從通知時開始計算 90 天。到期先標示「逾期／待管理員確認」，不自動釋出；Owner 正式釋出前會員仍可完成賣貨便下單。個別期限可不限次數延長，每次保存完整歷史。逾期釋出後不退款的法律效果，須完成台灣法律專業審閱後才可啟用。

一張 Order 可拆多個 Shipment；一個 Shipment 只屬一張 Order。不同 Order 不合併同一 Shipment。已下單、已出貨、已取貨及未取退回分開追蹤，未取件不自動重寄或取消。

## 10. 物流 Excel 與外部平台

Astera 是唯一真實資料來源；Excel 僅作為匯入、匯出、批次比對及外部平台介面。每次賣貨便 Excel 匯入建立 Import Batch，保存檔名、安全位置、匯入者、模板版本、總筆數、成功、待覆核、無法比對、重複及錯誤摘要。

結果至少分為自動成功、可能符合待人工確認、無法比對、重複匯入及欄位／狀態不支援。低信心結果不得自動確認。實際欄位、唯一鍵及狀態映射須以真實檔案驗證；未驗證前不得臆造。

## 11. 庫存、成本與分潤

現貨 Variant 在結帳時由 Server 鎖定可售庫存；訂單取消或付款逾期時依規則釋回。庫存不足不可結帳；不可超賣、超額配貨或超額出貨。

每批採購保存當時匯率，同一商品多批成本可計算加權平均成本。財務模組保存收入、商品成本、國際運費、包材費、其他正式成本、Receivable、Refund、Wallet Ledger 及 Adjustment。

Helper 分紅可依任務按件或固定金額計算，先列成本再計算 Owner／Partner 淨利。Owner／Partner 預設 50／50，可依商品或 Campaign 調整；調整需二次確認及 Audit Log。分潤狀態為草稿、已計算、待發放、已發放；歷史結算不可覆蓋。

## 12. Dashboard、搜尋、收藏與通知

登入後首頁是 Member Dashboard，優先顯示今天需要處理的事項：待付款、搶購結果、候補資格、二補待辦、修改確認、付款退回及其他有期限事項。沒有待辦時，提升即將結單商品的優先級。

前台支援商品、Campaign、Artist／CP、Brand／Series 搜尋；支援販售類型、Campaign、結單時間、價格及狀態篩選；支援即將結單、最新及價格排序。條件保留在 URL。會員可收藏商品，商品重新開賣或開始販售時可通知。

通知中心支援訂單、付款、搶購、候補、二補、出貨、公告及系統通知；支援未讀／已讀、手動清除及關聯訂單跳轉。Email 支援訂單建立、付款確認、搶購、候補、二補、退款及出貨；模板、版本、provider ID、失敗、重試及 Owner retry 都要保存。

## 13. 網站內容與同意

Owner 管理品牌介紹、FAQ、公告、購買流程、付款、取消退款、配送、客服、社群、Terms 及 Privacy。內容狀態為草稿、已發布、已封存；發布建立新版本，不覆蓋舊版本。

同意分三層：

1. 加入會員：會員服務、隱私、個資處理、帳號使用規範。
2. 一般下單：代購、付款、取消、退款、配送規則。
3. 特殊活動：搶購、候補、二補及商品釋出規則。

每次保存條款版本、生效日期、會員 UID、Checkout／Order 關聯、同意時間及不可變快照。90 天釋出及不退款文字需法律審閱。

## 14. 安全、Audit Log 與不可變性

Firestore／Storage deny-by-default。Client business writes 全部拒絕；所有高權限寫入透過受保護 API／Admin SDK。公開商品使用 `productsPublic`；私有成本、內部備註、付款、會員資料、銀行 Excel、附件及 Audit Log 不得公開。

Owner 使用 Firebase custom claim `role: owner`；Server 重新驗證價格、Campaign、庫存、期限、會員狀態及權限。Dev／Production 分離，不使用長期服務帳號私鑰。

付款、退款、Wallet、信用、取消、商品釋出、配貨、成本、匯率、分潤、黑名單、權限及 Excel 匯入等高風險操作均需二次確認與 Audit Log。Audit Log 只能新增；Payment、Refund、Ledger、Order snapshot 及歷史資料不能直接覆寫或物理刪除。

## 15. UI／UX 與可及性

前台採暖灰米白、Stone Grey、低飽和、安靜的收藏選物風格，不使用假促銷、假熱門、無根據推薦、未支援支付或假客服連結。後台以高資訊密度、搜尋、篩選、狀態及操作效率為主。

桌面 Dashboard 採左 32%／右 68%方向；手機商品列表兩欄，Dashboard 預覽可橫向滑動。所有頁面需處理 Loading、Empty、Error、Retry、已截止、已下架、失效購物車及權限不足。

互動控制項需有 keyboard focus-visible、skip link、route focus、ARIA live／alert、至少 44px 觸控目標及 reduced motion。狀態不可只靠顏色表達。

## 16. 階段與發布條件

### 已完成／現況

目前程式已涵蓋 Google Login、Profile、Owner Product／Variant／Campaign／分類、Partner Product／Variant／Campaign 草稿送審與 Owner 核准、SKU、公開 projection、Cart、Campaign 拆單 Checkout、ConsentRecord、未付款取消、基本 Payment、取消申請、通知事件、內容及基礎 Audit／Rules。

### 首次正式上線 MVP

完成 Campaign datetime、非 Owner／Helper／跨會員授權、完整付款及退款人工流程、多 Variant／Campaign 驗收、實際圖片、基本 Email、正式 Terms／Privacy、Rules、備份、Production 商品同步、網域、Resend、CI、Production smoke 及桌機／手機驗收。

### V1 擴充

Member Dashboard、搜尋篩選排序、收藏、搶購、候補、Guest Order、Wallet、信用額度、通知中心、內容版本 UI、台灣配送設定及現貨庫存鎖定。

### V2／長期規劃

採購、到貨、配貨、Shipment、二補／賣貨便、Excel 匯入、Partner／Helper 分潤、加權平均成本、Profit Settlement、完整 CRM／ERP／Finance、海外配送及外部 API。

正式發布前必須完成：程式與 migration dry-run、Vercel OIDC／Admin API、Rules 先 dev 後 production、備份與 projection audit、正式內容、Resend 實信、網域及 Authorized Domains、Production desktop／手機驗收、CI 全綠、Production smoke 及交接 SOP。

## 17. 待確認與外部依賴

- Partner 分類／品牌內容草稿、訂單營運與敏感資料的後續分批權限範圍；正式商品草稿權限已確認並完成。
- 搶購、候補及庫存鎖定的所有例外規則。
- 會員餘額特殊提領例外、少匯門檻及個資保存期限。
- 台灣配送方式實際啟用項目及費用。
- 賣貨便真實 Excel 欄位、唯一比對鍵及狀態映射。
- Terms／Privacy、取消退款、二補 90 天及商品釋出法律文字。
- Firebase Blaze、Storage bucket、Production Rules、Resend DNS／API key、正式網域及實機驗收。

## 18. 核心成功定義

Astera 的完整產品成功條件是：會員能以清楚、可追溯的方式完成從登入、商品／販售活動、一般預購或搶購登記、付款、候補、二補到出貨的流程；Owner 能在受保護的後台管理商品、訂單、付款、庫存、財務及內容；Partner 與 Helper 能在最小必要權限下完成被授權工作；所有金流、狀態、權限、通知、物流及歷史資料都能被正確追蹤，且不把尚未支援或尚未確認的服務承諾給會員。
