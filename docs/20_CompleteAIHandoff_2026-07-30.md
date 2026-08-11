# Astera OMS 完整 AI 交接資料

> **版本：** 2026-07-30 Final Consolidation  
> **目前分支：** `codex/mvp-completion`  
> **GitHub：** `https://github.com/astera-blip/Astera-OMS`  
> **Preview：** `https://astera-oms-git-codex-mvp-completion-astera-oms.vercel.app`  
> **Production：** `https://astera-oms.vercel.app`（尚未合併本分支最新修正）

本文件讓接手 AI 可以在**不重新設計架構、不重做已完成工作**的前提下繼續 Astera OMS。

## 0. 閱讀順序與衝突處理

接手 AI 必須先閱讀：

1. `AGENTS.md`：工作區執行規則；現有使用者修改不可覆寫或提交。
2. 本文件：目前整體狀態、正式決策、未完成清單與續作順序。
3. `docs/16_MVPCompletionPlan.md`：逐批執行及驗證歷程。
4. `docs/17_ProjectHandoff.md`：逐次交接、問題、修正、外部設定證據。
5. `docs/19_Astera_UIUX_Design_Handoff_v1.1.md`：未來整體 UI/UX 方向。
6. 任務相關的專門文件，例如 `docs/10_TestPlan.md`、`docs/14_Deployment.md`、`docs/SOP/正式資料備份與商品同步SOP.md`。

衝突優先順序：

1. 使用者最新明確指示。
2. 本文件的「已確認決策」與「目前真實狀態」。
3. 原始 Astera OMS 交接規格。
4. 其他文件中的歷史紀錄。

`docs/16`、`docs/17`、`docs/18` 中較早的「pending」敘述可能已被後續完成紀錄覆蓋；不可只讀文件前半段判斷狀態。

---

## 1. 專案目標與範圍

Astera OMS 是服務泰國 GL／藝人周邊代購的 **MVP 訂單管理系統**，不是 ERP。

MVP 範圍：

- Google 登入與會員資料。
- 公開商品瀏覽。
- Owner 商品、Variant、Campaign、分類與內容管理。
- 購物車與 Campaign 拆單 Checkout。
- 銀行匯款付款回報與 Owner 對帳。
- 訂單、付款、取消與稽核紀錄。
- 品牌內容、服務條款、隱私權、通知事件。

不得自行加入：

- Helper 高風險寫入權限。
- Warehouse、CRM、Finance、Analytics、Wallet 或其他 ERP 模組。
- 對既有 Collection 進行破壞性重設、合併 Product/Variant、推翻 Checkout 或 Order Flow。

可以延伸既有架構，但資料模型調整必須先說明理由並取得使用者確認。

---

## 2. 技術架構與不可違反的安全規則

### 技術架構

- Next.js 16、React、TypeScript。
- Firebase Authentication、Firestore、Firebase Admin SDK、Firebase Storage。
- Vercel、GitHub、GitHub Actions。
- ESLint、TypeScript、Unit Test、Firestore/Storage Rules Test、Playwright。

### 信任邊界

- `productsInternal` 是商品私有主檔。
- `productsPublic` 是前台唯一商品資料來源。
- 前端不得信任或決定價格、Campaign、權限、Order、Payment 狀態。
- 前端只傳「意圖」和 Firebase ID token；Server 重新驗證商品、Variant、Campaign、時間、價格、會員身分與權限。
- 所有業務資料 Client SDK 寫入應拒絕；由受保護 API / Firebase Admin SDK 寫入。
- Owner 權限唯一正式來源是 Firebase custom claim `role: owner`；**禁止用 Email 判斷 Owner**。
- Server 在 Vercel 使用 OIDC / GCP Workload Identity；**禁止使用長期 service-account private key**。
- 使用者資料、付款、取消、Audit Log、ConsentRecord、NotificationEvent 不可為了測試而硬刪除。

---

## 3. 正式資料與商業規格

### Product、Variant、Campaign

- Product：商品本體，含名稱、描述、分類、圖片、刊登狀態與內部備註。
- Variant：商品規格，含規格名稱、成本、原幣別、預設售價。
- Campaign：販售活動，含活動價、販售類型、開始/結束時間、公開提醒、二補說明、狀態。
- Campaign 價格優先；沒有有效 Campaign 價才使用 Variant Default Price。
- `archived` Campaign 不得進入 `productsPublic`。
- Campaign 狀態的 Server 語意：`upcoming | open | closed | archived`。
- 時間尚未到為 `upcoming`、過期為 `closed`、Owner 封存為 `archived`。

### SKU 與識別碼

- Product SKU：`AST-P000001`。
- Variant SKU：`AST-P000001-V001`。
- Sequence 由 `siteSettings/system-sequences` transaction 原子派發。
- Product 建立時自動有 Default Variant；後續 Variant 連續編號。
- 正常 UI 中 Product ID、Product SKU、Variant SKU 都唯讀，只提供「複製 ID」功能。
- Server 忽略 Client 傳入的 SKU。
- Variant 封存後不得補號；例如 V002 已封存，下一個仍是 V004。
- 已被 OrderItem 使用的 Variant SKU 永不可改寫；舊訂單 snapshot 永遠保留原值。
- 若未來真有 Product ID 修正需求，必須建立 Owner 專用、關聯檢查後一次遷移的工具；不可解除一般 input 鎖定。

### Checkout、付款、取消

- 購物車可混合不同商品、sale type、Campaign。
- Checkout 依 Campaign 自動拆成多張 Order，使用 `checkoutGroupId` 關聯。
- 正式訂單號格式：`AST-YYYYMMDD-0001`；Document ID 只作內部識別。
- Checkout 必須同意條款／隱私與二補規則，Server 必須驗證並建立 ConsentRecord。
- 會員付款回報先建立 `pendingReview` Payment。
- Owner 依既有 Payment ID 確認，不得重新輸入會員回報。
- 不足為 `partiallyPaid`、足額為 `paid`、超額存為 `unallocatedAmountTwd`；不建立 Wallet。
- 付款撤銷：Payment 標示 `reversed`，追加負向 adjustment，重算 PaymentRequest / Order / OrderItem，建立 Audit Log。
- 取消最小單位為 OrderItem。
- 未付款項目：直接取消並重算 Order / PaymentRequest。
- 已付款項目：建立取消申請；Owner 核准需填退款日期、金額、參考資料，建立負向 adjustment / Audit Log。

---

## 4. 已確認的 ProductWorkspace 與分類管理決策

此區為使用者已同意的操作規格，除非使用者另行改變，不可回退。

### 商品 UI

- Product、Variant、Campaign 欄位採 `English（中文）` 顯示。
- Product ID、Product SKU、Variant SKU：系統派發、不可編輯、提供複製按鈕。
- SKU 說明要清楚顯示「系統自動派發、不可修改、封存後不補號」。
- Internal Note 需顯示以下輔助文字：

  `僅供後台作業使用，不會顯示於商品頁。可記錄採購來源、限購、成本或交接事項。`

- Product 刊登狀態：
  - `Draft（草稿）`
  - `Published（已刊登）`
  - `Archived（已封存）`
- Campaign 狀態：
  - `Upcoming（即將開始）`
  - `Open（開放中）`
  - `Closed（已結束）`
  - `Archived（已封存）`
- Sale Type：
  - `In Stock（現貨）`
  - `Preorder（預購）`
  - `Rush Purchase（代搶）`
  - `Waitlist（候補）`
- 新 Variant 原幣別預設 `THB（泰銖）`，可改為 `TWD（新台幣）`、`JPY（日圓）`、`KRW（韓元）`、`USD（美元）`。
- Variant Name 目前保留自由輸入；下拉選單／建議值行為尚未獲確認，不可自行改成固定選項。

### Classification Master

- ProductWorkspace 有 `Products（商品管理）` 與 `Classifications（分類管理）` 分頁。
- Company、Artist、CP、Brand、Series 分別管理。
- 商品分類選單旁提供「管理分類」捷徑。
- 分類 ID 由 Server 建立；操作者只填顯示名稱。
- 分類可改顯示名稱與封存，禁止硬刪除。
- 分類狀態：`Active（啟用）` / `Archived（已封存）`。
- 必須驗證空白名稱與重複名稱。
- 分類主檔目的：統一名稱，避免 Freen / freen / FREEN 等變成多筆不一致分類，並保護歷史訂單與未來篩選。

---

## 5. UI/UX 正式方向

詳細版請讀 `docs/19_Astera_UIUX_Design_Handoff_v1.1.md`，此處是不可忽略的摘要。

- 定位：品牌官網 × 收藏選物店 × 會員訂單管理平台；不是促銷型大賣場。
- 視覺：Stone Grey／暖灰米白、低飽和狀態色、細緻留白、Minimal / Calm / Refined / Gallery-like。
- MVP 對買家只能承諾已支援的功能：Google 登入、銀行匯款；不可寫多元付款、刷卡、即時付款完成、假連結、假人氣或假優惠。
- 結單日期是購買決策資訊，商品卡、Campaign、詳情、購物車、訂單必須清楚呈現。
- Campaign 是重要入口但仍為選填關聯；無 Campaign 商品仍可存在。
- 登入後首頁長期定位為 Member Dashboard：待處理事項、即將結單、通知、活動、商品。
- 手機商品列表為兩欄；Dashboard 預覽可水平滑動。
- 前台須有清楚 empty / loading / error / retry 狀態；不可暴露 Firestore、custom claim、owner email、Phase、snapshot 等技術文字。
- 後台以高資訊密度、搜尋、篩選、狀態與 Audit Log 為重；前台以理解與品牌感為重。
- 可及性：focus-visible、skip link、route focus、ARIA live、44px 觸控目標、reduced motion、可見錯誤訊息。

尚未完成的長期 UI 設計項目（不是本輪 MVP 程式阻塞）：完整 Member Dashboard、Campaign 一級瀏覽頁、候補 Dashboard/通知、搜尋、收藏、完整後台資訊架構與 Figma 設計稿。

---

## 6. 已完成的程式與功能

### Authentication、會員、權限

- Google Login、Firebase Auth、Member Profile 已完成。
- Profile 採受保護 `/api/member/profile`，姓名欄位已拆為姓／名；成功後導回首頁。
- Google popup/redirect、未授權網域等錯誤文案已改善。
- 會員 Profile、Cart、Content、Member private notes 寫入已移到受保護 API。
- Owner / Helper / Member role 基礎存在，Owner 使用 custom claim 驗證。
- 會員風險狀態、黑名單阻擋 Checkout、重複電話提示、內部備註與 Audit Log 已有 MVP 支援。

### 商品、分類、SKU、公開投影

- Owner-only Product API：`src/app/api/workspace/products/route.ts`。
- Owner-only Classification API：`src/app/api/workspace/classifications/route.ts`。
- ProductWorkspace 已改為 protected API 存取，支援多 Variant / 多 Campaign。
- SKU transaction 自動派發、Server 忽略 Client SKU、封存不補號已實作。
- `productsInternal → productsPublic` projection 已實作；公開投影排除 SKU、成本與內部備註。
- 前台商品只讀 `productsPublic`。
- 商品圖片的 Storage Emulator UI/API/metadata registration、最多八張、排序、cover、alt text、公開 projection 與 Storage Rules 已完成；真實 bucket 驗收見「外部阻塞」。

### 購物車、Checkout、訂單

- Cart 使用受保護 API，並修正 local/cloud hydration 空資料覆寫問題。
- Checkout 使用 Server 權威資料，允許混合 sale type，按 Campaign 拆單。
- Checkout 強制條款／隱私與二補同意，產生 ConsentRecord。
- `orderNumber`、`checkoutGroupId`、order snapshot、冪等邏輯已實作。
- 訂單列表與詳情優先顯示正式 `orderNumber`，僅舊資料才 fallback 內部 ID。
- 新增 protected `GET /api/orders/[id]`：用 Firebase token + Admin SDK 驗證擁有權並回傳該會員自己的 Order、Items、PaymentRequest、CancellationRequests；避免 Client Firestore Rule 不一致造成整頁讀取失敗。

### Payment、Cancellation、通知

- 會員 Payment Report、Owner confirm、partial / full / overpayment、`unallocatedAmountTwd`、Owner reverse、adjustment、Audit Log 已實作。
- 未付款直接取消、已付款取消申請、Owner refund metadata review、負向 adjustment 與 Audit Log 已實作。
- `notificationEvents` 支援 pending/sent/failed、嘗試次數、Resend provider ID、安全化錯誤與 Owner retry。
- Email 寄送失敗不回滾 Order 或 Payment 交易。

### Content、法律、前台

- 品牌內容使用 Firestore / Admin repository；前台已移除多數 MVP、Firestore、Owner 後台等技術文案。
- `/terms`、`/privacy` 已存在，Checkout 有版本化 consent。
- Homepage、商品、空購物車、Footer、Profile、Cart 的消費者文案與空狀態已改善。
- Instagram「暫不提供」已移除；首頁名稱已修正為 `ASTERA OMS`。

### 測試、CI、部署準備

- Unit、Firestore Rules、Storage Rules、desktop/Pixel 7 Playwright、Auth/Firestore/Storage Emulator Playwright 工具已建立。
- GitHub Actions 包含 lint、typecheck、unit、secret scan、production audit、build、rules、Playwright / emulated Playwright 工作。
- production environment check、產品 projection audit、匿名 production smoke、backup/sync/rollback SOP 已建立，工具均為唯讀。
- Vercel OIDC / GCP Workload Identity 已設定為無長期私鑰模式；Preview Server Admin API 實際流程已驗證。

---

## 7. 最新 Preview 真實驗證（2026-07-30）

此段是目前最可信的端對端人工測試證據。

### 測試邊界

- 僅使用 `codex/mvp-completion` Preview；沒有開啟、寫入、部署或修改 Production。
- 測試帳號：`astera.0920@gmail.com`，具有 Owner custom claim。
- 因為此帳號是 Owner，本輪不能作為 non-Owner Workspace 拒絕驗證。
- 沒有匯款、Payment Report、付款確認、付款撤銷、退款或出貨。

### 測試資料與結果

| 項目 | 結果 |
| --- | --- |
| Test Product ID | `ZdW58A6aZqJLVHvioU6W` |
| Product SKU | `AST-P000003` |
| Variant SKU | `AST-P000003-V001` |
| 商品 | `【測試專用】Preview Checkout — 請勿付款` |
| Variant | `Test Variant（測試規格）` |
| Campaign | `TEST-ONLY Preview Checkout — 請勿付款` |
| 初始價格 | NT$1 |
| 訂單內部 ID | `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1` |
| 正式訂單號 | `AST-20260730-0001` |
| 下單前 | Order/Item 待付款；PaymentRequest 待付款 NT$1 |
| 取消後 | Order 已取消 NT$0；Item 已取消；PaymentRequest 已取消 NT$0 |
| 商品最終狀態 | Product / Campaign 已 Archived，公開 `/products` 不再看見 |

測試中發現並已修正：

1. ProductWorkspace 初次 GET 尚未完成時可送出，可能誤修改第一筆商品；已加載入期 mutation gate。
2. Firestore Timestamp 直接進 React 導致 order history crash；已在 repository / API 邊界 ISO 化。
3. Client SDK 的 cancellationRequests read 受 Preview Rules 拒絕，使 order detail 整頁失敗；已改 protected member detail API。
4. Member UI 顯示 Firestore document ID；已改顯示 official order number。

### 本輪最後驗證結果

- Unit：26 files / 133 tests passed。
- TypeScript：passed。
- ESLint：passed。
- Next.js production build：passed。
- Browser Preview：商品建立 → 公開投影 → cart reload → one Checkout → unpaid direct cancellation → reload terminal state → archive → public hide，全部通過。

未在本輪重新執行 Firebase Rules / Storage Rules / 全套 Playwright；它們在較早批次已建立並通過，下一輪大型變更或正式上線前必須再完整重跑。

---

## 8. 已知問題、未完成工作與外部阻塞

### A. 可由下一位 AI 繼續完成

1. **Campaign 日期時間欄位驗證 / 修正**
   - Browser automation 能填 `datetime-local`，但儲存後 returned record 的 start/end 沒保留。
   - 本輪以明確 `Open` 狀態完成測試，不代表時間規則已完成驗收。
   - 需先以單元/API 測試重現，再修正 ProductWorkspace payload、Server normalization 或 UI input event。

2. **非 Owner / Helper 權限驗收**
   - 真正 member 不可進 Owner Workspace。
   - Helper 不可取得高風險 mutation。
   - 跨會員 Order、Payment、Cancellation、private notes 資料必須拒絕。
   - 建議以 Auth / Firestore Emulator Playwright 加上 Preview 手動驗收。

3. **付款完整人工流程驗收**
   - pendingReview report。
   - Owner confirm。
   - partial / exact / overpayment。
   - `unallocatedAmountTwd` Owner UI。
   - reverse。
   - paid-item cancellation request / Owner refund review / adjustment / audit。
   - 測試資料必須清楚標示 TEST-ONLY 且不可觸發實際金流。

4. **多 Variant / 多 Campaign 操作驗收**
   - 建立、價格優先、封存、新 SKU 不補號、前台 projection、Campaign time state、拆單需以實際 UI 驗證。

5. **正式品牌與法律內容最終化**
   - 所有客服資料、LINE／Instagram（有資料才啟用）、付款、二補、取消、配送文案需由營運方提供最終版本。
   - Terms / Privacy 仍需法律／營運確認。

6. **完整正式驗收**
   - Desktop、Pixel 7、實機 iPhone/Android。
   - loading / empty / error、表單、select、datetime、textarea、navigation、focus、觸控大小。

### B. 需要使用者或外部帳號完成

1. **Firebase Blaze 與 Storage bucket**
   - Development / Production 都需 Blaze。
   - 在 `asia-east1` 建立實際 Storage bucket。
   - 之後才可做正式圖片上傳、metadata、公開讀取與真實圖片驗收。

2. **Production Firestore / Storage Rules 部署**
   - 先 deployment 前備份與 read-only audit。
   - Development Rules 驗證後才 Production。
   - 需確認匿名能讀公開 `productsPublic`，私有主檔與所有 Client business writes 均拒絕。

3. **正式商品 migration / re-save**
   - 先備份 Production。
   - 執行 `productsInternal → productsPublic` dry-run / audit。
   - 核對商品數、Variant、Campaign、SKU、價格、公開欄位。
   - 保留 Document ID，透過 Owner API 重新儲存同步，不可破壞訂單 snapshot。

4. **Resend 實際寄信**
   - 驗證 `updates.asteratw.com` SPF/DKIM。
   - 設定 Production `RESEND_API_KEY`。
   - 寄件者 `Astera <orders@updates.asteratw.com>`；Reply-To 使用正式客服信箱。
   - 實際驗證 order-created、payment-confirmed、failed、retry、provider ID。

5. **正式網域 / DNS**
   - 購買並設定 `asteratw.com`。
   - Canonical：`asteratw.com`；`www` 轉址。
   - 加入 Firebase Authorized Domains、Vercel domain、Resend DNS。

6. **正式上線前 Production 驗收**
   - 確保 Vercel Production 不含 Emulator 或 E2E auth flags。
   - 執行 production environment check、product projection audit、anonymous smoke。
   - 以 Google 實際登入、手機、正式商品、圖片及信件做最後驗收。

---

## 9. 建議續作順序

1. 修 Campaign `datetime-local` persistence，補 Unit/API/Playwright 回歸。
2. 用 Emulator 完成 non-Owner / Helper / cross-member authorization coverage。
3. 建立清楚的 TEST-ONLY 資料，完成付款與已付款取消的可回復驗收。
4. 確認 Blaze / Storage bucket 後完成真實圖片上傳與 Storage Production 驗收。
5. 完成正式品牌、客服、FAQ、付款、二補、取消、配送、Terms / Privacy 內容確認。
6. Firebase Rules deploy 前跑 backup、audit、Rules tests；先 dev 後 production。
7. Production 商品 re-save / projection 核對。
8. Resend DNS/API key/實際送信。
9. Domain / Firebase Authorized Domains / Vercel Production 設定。
10. 最終 CI、Production smoke、Pixel 7 與實機驗收後，才考慮 merge/deploy `codex/mvp-completion` 至正式站。

---

## 10. 常用驗證與部署指令

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run firebase:rules:test
npm run build
npm run test:e2e
npm run test:e2e:emulated
npm run check:secrets
npm run audit:production
```

Production 唯讀 preflight：

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
```

注意：Windows managed sandbox 可能使 Java / Firebase Emulator / Playwright 出現 `spawn EPERM`；需要經核准的非 sandbox 執行。Production audit 指令是唯讀，仍不可把它當作已完成 migration 或 Rules deploy。

---

## 11. 最新 Commit 與工作區狀態

最新重要 commits：

- `a20b223` `docs: record reversible checkout preview test`
- `c3825e4` `fix: load member order detail through protected api`
- `dda0c95` `chore: log safe order detail read diagnostics`
- `01f0c1c` `fix: normalize cancellation timestamps for member details`
- `d22115b` `fix: normalize order timestamps for member views`
- `e8fa9f6` `fix: prevent product saves during catalog loading`
- `b93c8e3` `docs: define reversible checkout preview test`

工作區特別規則：

- 現有 `AGENTS.md` 是使用者自己的未提交修改；不可 stage、commit、restore 或覆寫。
- 新 AI 開始任何修改前先做 `git status --short`。
- 不要對 `main` 或 Production 進行直接 destructive 操作。
- 每個功能需先測試重現、最小修正、重新驗證，再更新 `docs/16`、`docs/17` 與本文件。

---

## 12. 文件索引

| 文件 | 用途 |
| --- | --- |
| `docs/00_ProjectVision.md` | 初始專案願景 |
| `docs/01_BusinessRules.md` | 商業規則 |
| `docs/02_SystemArchitecture.md` | 架構 |
| `docs/03_DomainModel.md` | 領域模型 |
| `docs/04_DatabaseDesign.md` | Firestore 模型 |
| `docs/05_API.md` | API 概要 |
| `docs/06_UIFlow.md` | 初始 UI Flow |
| `docs/07_Workflows.md` | 業務流程 |
| `docs/08_SecurityDesign.md` | 安全設計 |
| `docs/09_CodingRules.md` | Coding Rules |
| `docs/10_TestPlan.md` | 測試與 CI 規格 |
| `docs/11_Changelog.md` | Changelog |
| `docs/12_DecisionLog.md` | 已確認決策 |
| `docs/13_LegalAndPrivacy.md` | 法律與隱私草案 |
| `docs/14_Deployment.md` | 部署與 OIDC 說明 |
| `docs/15_LocalDevelopment.md` | 本機開發 |
| `docs/16_MVPCompletionPlan.md` | 完整批次執行紀錄 |
| `docs/17_ProjectHandoff.md` | 歷史交接與技術證據 |
| `docs/18_AIContinuationBrief.md` | 舊版精簡交接；部分狀態已被本文件覆蓋 |
| `docs/19_Astera_UIUX_Design_Handoff_v1.1.md` | 完整 UI/UX 設計需求 |
| `docs/20_CompleteAIHandoff_2026-07-30.md` | 本文件；最新完整 AI 交接入口 |
| `docs/21_Astera_OMS_MVP_PRD.md` | MVP Product Requirements Document |
| `docs/99_PendingOwnerReview.md` | 營運／法律／外部帳號待確認事項 |
| `docs/SOP/正式資料備份與商品同步SOP.md` | 正式資料 backup / sync / rollback SOP |

## 一句話交接

Astera OMS 的 MVP 核心流程已在 Preview 驗證到「Server SKU 商品建立 → 公開投影 → 購物車 → Campaign 拆單 Checkout → 未付款直接取消 → 商品封存」；下一階段重點是 Campaign 日期、非 Owner 權限、付款完整人工驗收，以及 Blaze/Storage、Rules、Resend、Domain、Production migration 與實機上線驗收。
