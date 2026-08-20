# Astera OMS 商品管理 UX 與成本工作流設計

日期：2026-08-20

狀態：設計草案，待進入 implementation plan

## 1. 目標

將商品管理從「逐筆編輯 Variant 的資料表單」改成符合營運人員思考順序的工作流：

商品資訊 → Option Builder → 售價 → Variant 預覽與批次調整 → Campaign → 儲存。

本次完整需求分成 P0、P1、P2 逐批實作。每一批都必須通過該批測試與 regression，再進入下一批；所有階段都屬於本產品範圍，不因分批而刪除。

## 2. 現況與不變條件

目前 workspace 使用單一 `ProductWorkspace` 元件，同時管理商品、分類、Variant、Campaign、圖片與儲存。後端以 Firestore 的 `productsPublic`、`productsInternal`、`productVariants`、`saleCampaigns` 四組 collection 組成商品資料，Owner/Partner 透過 workspace API 讀取，Owner 直接儲存，Partner 透過 catalog change request 送審。

Variant 目前只有名稱、價格、預設狀態與可選的成本欄位；正式成本實際保存在 `productsInternal.originalCosts[]`。訂單會保存商品名稱、Variant 名稱、SKU 與售價快照，因此商品後續修改不得改寫歷史訂單。

下列契約不可破壞：

- 既有 Product ID、Variant ID、Campaign ID 與 SKU。
- 有訂單的 Variant SKU 不得重新派發。
- 舊 Variant 只有 `name` 時仍可讀取與編輯，不要求一次性 migration。
- Campaign、圖片、分類、Partner 草稿審核與 Owner/Partner 權限。
- 成本為未知時必須保持 `null`/缺值語義，不得當作 0。
- 封存必須是 server-authoritative 的軟封存，不能只修改瀏覽器狀態。

## 3. 設計決策

採用低風險的 additive schema 方案，不做破壞性 migration：

1. 在 workspace 產品資料中加入可選的 Option metadata。新商品使用結構化 option；舊商品沒有 metadata 時，沿用既有 Variant Name fallback。
2. 新 Variant 可帶有可選的 option value mapping；既有 Variant 的 mapping 缺失不阻止儲存。
3. 產品可保留一個可選的 workspace default price，若舊商品沒有此欄位，從既有 default Variant 或第一個 active Variant 推導。
4. `productVariants.priceTwd` 仍保存最終售價；Option group 套用與個別 override 只在編輯器內計算後寫入最終值，不改變訂單價格快照。
5. `productsInternal.originalCosts[]` 繼續作為成本的相容儲存位置，但新增專用成本讀寫服務與嚴格 nullable validation；不把成本搬到另一個必填 collection。
6. 不使用 Variant Name 作為 identifier。Option 組合比對只使用穩定的 group/value metadata；沒有 metadata 的舊資料只做名稱 fallback，不自動猜測組合。

替代方案（只把 Option 轉成文字）無法可靠保留 Variant 或支援群組批次操作；全面 migration 則會提高 production SKU、訂單與舊資料風險，因此不採用。

## 4. P0：核心可上線流程

### 4.1 新增/編輯頁

- 移除新增商品時逐筆建立 Variant 的主要 UX。
- 改成全寬、垂直分段頁面，不再使用桌面左右 50/50 編輯佈局。
- 新增商品只顯示商品資訊、Options、售價與必要的公開欄位；ID/SKU 儲存前顯示「儲存後自動建立」，儲存後才顯示可複製 metadata。
- Campaign 是獨立區段，不與 Variant 編輯器混成同一張卡片。
- 保留 Partner 草稿標題、原因、送審與 stale-base 行為。

### 4.2 Option Builder

- 支援 0、1、2 個 option groups。
- 每組可新增、編輯、刪除值，支援 Enter 新增 chip。
- group/value 會 trim；空白、重複值及重複組合在儲存前顯示行內錯誤。
- 顯示預計 Variant 數量；0 option 代表單一商品，後端建立一個 Variant，但 UI 不顯示「Default Variant」這個內部名稱。
- 1 組產生 N 筆，2 組產生 N×M 筆 Cartesian product。

### 4.3 Variant 生成與保留

- 由 option combination 自動產生 Variant name。
- 既有 combination 優先保留既有 Variant ID、SKU、價格、成本與啟用狀態。
- 新 combination 由 server 產生新 ID/SKU；有訂單的舊 Variant SKU 永遠鎖定。
- option 刪除或組合減少時，先顯示受影響清單與明確確認；不得靜默刪除或重建全部 Variant。
- 舊商品沒有 structured options 時，以目前 Variant Name 顯示 legacy mode，讓 Owner 可逐步建立 Option metadata。

### 4.4 價格

套用順序為：產品預設售價 → Option group bulk price → individual override。所有結果最後寫入 `priceTwd`，且必須是非負整數。

P0 先支援產品預設與 individual override；Option group bulk price 的完整操作列入 P1，但資料格式與 P0 生成器預留相同的 precedence。

### 4.5 成本

- 新商品成本 optional，空白成本寫成 null/缺值，不阻擋建立。
- 幣別只有在輸入成本時才有效；成本為空時不保存無意義的幣別。
- 新增 Owner 可用的 `/workspace/pending-costs` 工作頁。
- 預設顯示 `originalCost` 為 null 或缺值的 active Variant，按 Product 分組。
- 每筆顯示 Product、Variant、option/name、selling price、cost、currency。
- 支援 Product-level bulk cost、individual override、批次儲存。
- 批次 API 使用產品版本/更新時間做 stale guard，回傳每列成功或失敗，不把成功列誤標為失敗。
- 支援 pending/completed/all、搜尋與既有分類關聯篩選；未儲存變更離開頁面時提醒。

## 5. P1：效率功能

- Option group price bulk edit。
- Option group cost bulk edit。
- 「儲存並新增下一項」，只保留安全的 shared context，不複製 Product-specific data、ID、SKU、Variant、成本或 Campaign。
- Duplicate Product：複製非唯一設定、Option structure 與價格，重新產生 ID/SKU，預設不複製成本；需調查並明確處理 Campaign duplicate。
- Pending Cost 搜尋、分類/關聯篩選、Workspace badge count。

## 6. P2：操作 polish 與擴充

- 更完整鍵盤操作、focus management、快速新增與排序。
- Option builder 可擴充至 N-level，但維持 P0/P1 的既有資料格式與 Cartesian product 安全檢查。
- 減少不必要的動畫；支援 `prefers-reduced-motion`。
- 清單大型資料的分頁/虛擬化與效能優化。

## 7. API 與權限

新增或擴充 workspace server service，而不是讓瀏覽器直接讀寫 Firestore：

- `GET/POST /api/workspace/products`：保留 Owner/Partner 讀取與 Owner 寫入；Partner 仍走 catalog change requests。
- 產品儲存 transaction 擴充 option metadata、組合保留、archive 與 nullable cost validation。
- `GET /api/workspace/pending-costs`：沿用現有 catalog read permission，回傳遮蔽以外的內部成本只給已授權 workspace 使用者。
- `PATCH /api/workspace/pending-costs` 或批次 endpoint：Owner-only，支援 idempotent row updates、expected product version、逐列結果與權限錯誤。
- 不新增 client Firestore 權限；Admin SDK 仍是唯一 trust boundary。

所有輸入在 server 端重新驗證：Option 名稱和值不可空白/重複、Variant combination 不可重複、價格非負整數、成本 finite 且非負、currency 必須是允許 enum 且只能與非 null 成本一起保存。

## 8. 元件與頁面拆分

將目前大型元件拆成可測試的責任邊界：

- `ProductManagementPage`：載入、選擇、權限與整體 save state。
- `ProductList`：搜尋/狀態/選取語義。
- `ProductInfoSection`：名稱、說明、分類、圖片、內部備註。
- `OptionBuilder`：groups/values、chip、組合數量、刪除確認。
- `VariantPreviewTable`：compact rows、group collapse、bulk actions、legacy fallback。
- `PriceInheritanceEditor`：product/group/individual precedence。
- `CampaignSection`：活動欄位與獨立 archive。
- `PendingCostWorkspace`、`PendingCostProductGroup`、`PendingCostRow`、`PendingCostBatchBar`。
- `ProductSaveActions`：儲存、送審、儲存並新增下一項、dirty state。

所有互動元件需有可見 label、keyboard focus、aria-live status、錯誤靠近欄位、44px 以上觸控目標與 mobile 無水平溢出。

## 9. 資料相容與 migration

不執行一次性 migration。新欄位全部 optional：

- 舊 productsInternal、productVariants 與 originalCosts 讀取不變。
- 未提供 option metadata 時，維持 legacy mode。
- 舊成本缺值仍回傳 pending；既有零成本若歷史上確實為 0，保留為 completed，不可轉成 null。
- SKU sequence、orderItems relation 與 archive docs 不重建。
- 新功能 rollout 前先以 emulator/fixture 驗證舊文件、缺欄位、已封存 Variant、有訂單 Variant 與 Partner draft。

若未來要引入獨立 option collection，必須另開 migration design；本次不做。

## 10. 測試與驗收

P0 至少涵蓋：

- 無 option 單一商品建立、後端單一 Variant、成本 null。
- 一層 option 自動產生 N variants。
- 兩層 option Cartesian product。
- 產品預設價與 individual override。
- option 變更保留既有 Variant ID/SKU/價格/成本；刪除需確認。
- 全部 null、部分已補成本、批次成本套用、個別 override、完成後移出 pending。
- pending/completed/all、搜尋、分類篩選、空態、stale、permission、partial failure。
- 既有商品、Campaign、圖片、分類、SKU、訂單 checkout、archive、Partner 審核與 Firestore rules regression。

P1/P2 各自新增對應 unit、integration、e2e 與 accessibility 測試，不以 CSS snapshot 代替行為測試。

每一階段完成前執行可用的 lint、typecheck、unit/integration/e2e、production build；若專案沒有某項 script，最終報告明確說明。

## 11. Rollout 順序

1. 完成並 review 本設計與 implementation plan。
2. P0 先以 feature-safe additive schema 實作，測試與獨立 reviewer 通過後再合併。
3. P1 依序加入批次效率功能，沿用 P0 API/資料格式。
4. P2 最後加入操作 polish 與 N-level 擴充。
5. 每批保留 rollback 能力：新欄位可忽略，舊 UI/API 仍能讀取舊文件。

## 12. 主要風險

- Option 組合與既有 Variant 的對應若不穩定，可能造成 ID/SKU 或成本遺失；必須以穩定 group/value IDs 和明確刪除確認處理。
- 現有直接 products API 的 runtime validation 不完整；P0 必須先補 server validation，避免非法成本或重複組合落庫。
- Partner 目前可讀取完整 workspace product cost；若日後需要更細的成本權限，另開權限設計，不在 UI 重構中偷偷改變既有權限。
- 成本目前沒有歷史 audit；P0 保留現況並記錄為後續風險，不把可變商品成本當作訂單歷史成本。

