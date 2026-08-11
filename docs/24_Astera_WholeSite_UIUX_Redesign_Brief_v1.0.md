# Astera OMS 整站 UI/UX 改版需求（已填寫版）

版本：v1.0  
日期：2026-08-02  
適用專案：Astera 泰國 GL／藝人周邊會員制代購平台

> 本文件是可直接交給前端、設計師或其他 AI 的整站改版規格。若與較早討論內容衝突，以本文件為本次 UI/UX 改版基準；資料模型、Firebase Rules 與既有商業邏輯仍以產品需求書為準。

## 1. 改版範圍

這次是整站重新設計，不是局部調色或微調。

需要改版的頁面：

- `/` 首頁
- `/products` 商品列表
- `/products/[id]` 商品詳情
- `/cart` 購物車
- `/checkout` Checkout／訂單建立
- 會員登入與登入閘門
- `/account/profile` 會員資料
- `/account/bank-accounts` 銀行帳戶
- `/payments` 付款回報
- `/orders` 訂單
- `/brand` 品牌頁、FAQ、客服
- `/workspace` Owner 後台

公開前台、會員中心與 Owner Workspace 必須有清楚的視覺分層，不可全部套用同一種 OMS 儀表板版型。

## 2. 改版目標

### 公開前台

網站應呈現為：

- 泰國 GL／藝人周邊代購選物店
- 商品與 Campaign 優先，不像內部 OMS 工具
- 讓訪客容易瀏覽、搜尋、查看規格與結單時間
- 加入購物車前必須使用 Google 登入
- 首次登入先完成會員資料
- 付款只使用銀行匯款

### 會員中心

- 清楚看到待付款、付款回報、即將結單與訂單狀態
- 可管理最多 5 筆已認證銀行帳戶
- 可選擇自己的匯款帳戶並回報付款
- 可查看付款已認列、待確認、問題與失效狀態

### Owner Workspace

- 維持高資訊密度與高效率
- 支援商品、Campaign、會員、訂單、付款、取消申請與對帳處理
- 使用相同 Design Token，但不可使用公開前台的大型品牌 Hero 版型

## 3. 首頁版面

首頁順序固定為：

1. Header
2. Hero 品牌區
3. 最新活動／Campaign
4. 商品推薦 Grid
5. 購買流程
6. 二補說明
7. FAQ／客服
8. Footer

### Header

- 左側：ASTERA Logo；使用收藏、編輯感的襯線字體
- 導覽：商品、Campaign／品牌、FAQ／客服
- 右側：購物車、會員入口
- 未登入：顯示「使用 Google 登入」
- 已登入：顯示會員中心與頭像／姓名
- Header 使用白色表面與細邊框，不使用厚重陰影

### Hero

- 主標：泰國 GL／藝人周邊代購
- 副標：強調商品資訊、Campaign、結單與銀行匯款流程清楚
- 主要 CTA：立即看商品
- 次要 CTA：了解購買流程
- 不使用 OMS、Firestore、Custom Claim、Owner、Audit Log、MVP、技術狀態或開發階段文字

### 最新活動／Campaign

每個 Campaign 卡片必須顯示：

- Campaign 名稱
- GL／藝人／系列標籤
- 販售類型：現貨、預購、搶購、候補
- 結單日期與時間
- 剩餘時間文字，例如「剩 3 天｜8/10 23:59 結單」
- 二補提示（若有）

同一 Campaign 的所有商品使用同一個截止時間。

## 4. 商品列表與詳情

### 商品列表 `/products`

#### 桌面版

- 4 欄商品 Grid
- 商品圖片比例 4:5
- 商品圖片是主要視覺主角

#### 平板版

- 建議 3 欄
- 寬度不足時降為 2 欄，不得截斷或水平溢出

#### 手機版

- 2 欄商品 Grid
- 不得水平溢出
- 商品卡按鈕與互動目標至少 44×44px

#### 商品卡內容

- 商品圖片
- 商品名稱
- 售價
- Sale Type
- Campaign
- 結單時間
- 二補 Badge（若有）
- `加入購物車` 按鈕

### 商品詳情 `/products/[id]`

- 圖片、名稱、售價、規格與 Campaign 位於主要視覺區
- 清楚顯示販售類型、結單時間、二補規則
- 未登入可查看詳情
- 未登入按加入購物車時，先顯示 Google 登入閘門；登入成功後回到原商品頁並保留原本操作意圖
- 已登入但未完成會員資料時，導向 `/account/profile`
- 已登入但沒有銀行帳戶時，允許瀏覽與購物車操作，但在建立訂單／付款前導向銀行帳戶頁

## 5. 視覺風格與 Design Token

### 色彩

| Token | 色值 | 用途 |
| --- | --- | --- |
| `color.page` | `#F7F3F2` | 暖白頁面背景 |
| `color.surface` | `#FFFFFF` | 卡片、輸入區、Header |
| `color.ink` | `#20242B` | 文字、導覽、主要結構 |
| `color.border` | `#DED7D6` | 邊框、分隔線 |
| `color.textSecondary` | `#6C6B70` | 輔助說明 |
| `color.brand` | `#6E4E64` | Google 登入、主要 CTA、選取狀態 |
| `color.brandSoft` | `#E7DDDF` | 品牌柔和背景 |
| `color.service` | `#466060` | 會員、銀行帳戶、付款與服務資訊 |
| `color.campaign` | `#F8C7CC` | GL／藝人 Campaign Badge 與活動提示 |
| `color.catalog` | `#81A684` | 商品分類、現貨／預購等低優先 Badge |

### 元件語言

- 暖白背景、白色表面、細邊框
- 大區塊卡片圓角約 12px
- 商品／Campaign 卡片圓角約 10px
- Button 圓角約 8px
- Badge 使用膠囊或 6px 圓角
- 一般卡片不使用厚重陰影
- 不使用大量深色資訊卡
- 不使用 Emoji 作為主要圖示
- 不使用不一致的 slate／amber 主色
- ASTERA Logo 與主要標題使用襯線字體；UI、表單與說明使用清楚的無襯線字體
- 所有主要文字與 CTA 必須符合 WCAG AA 對比

## 6. 功能限制

### 保留現有功能

- Firebase Google 登入
- `productsPublic` 前台資料來源
- Product／Variant／Campaign API
- 購物車
- Campaign 拆單 Checkout
- 會員付款回報
- Owner 付款確認與撤銷
- 取消申請
- Firebase Rules
- 現有資料模型與 Collection
- 台新銀行 Excel 對帳與付款資料比對的既有核心邏輯

### 不可自行修改

除非 Owner 另外確認，不要：

- 修改 Collection 架構
- 改寫 Checkout 商業邏輯
- 新增 ERP 功能
- 新增 Member Preorder
- 將前台改成直接讀 `productsInternal`
- 新增信用卡、電子支付或其他未確認付款方式

## 7. 會員、銀行帳戶與付款互動規則

### 登入

1. 訪客可瀏覽商品、Campaign、品牌與 FAQ。
2. 訪客加入購物車前必須使用 Google 登入。
3. 首次登入先補會員資料：姓名、社群內 ID、手機；生日選填。
4. 登入成功後返回原本想執行的頁面或操作。

### 銀行帳戶

- 每位會員最多 5 筆有效銀行帳戶。
- 可不同銀行，也可同一銀行多筆帳戶。
- 登記欄位只有銀行代碼與完整銀行帳號。
- 前 5 筆只需通過真實銀行帳號格式驗證即可自動通過，不需管理員審核。
- 會員不可自行刪除或修改已登記帳戶。
- 超過 5 筆時，必須提出更換／封存申請，由管理員審核。
- 舊帳戶保留歷史紀錄，只有狀態變為封存後，新帳戶才可成為有效帳戶。
- 前台必須清楚顯示「已認證」、「使用中」、「封存申請中」等文字狀態。

### Checkout

- 只有已登入會員可以建立訂單。
- 購物車可混合不同 Campaign 商品；建立訂單時依 Campaign 拆單。
- 同一 Campaign 使用同一個結單時間。
- 若在結單前沒有確認付款，該訂單轉為失效。
- Checkout 只顯示銀行匯款，不顯示信用卡或電子支付。
- 沒有已認證銀行帳戶時，顯示「綁定銀行帳戶」並保留回到 Checkout 的路徑。

### 付款回報 `/payments`

會員必須：

- 選擇自己的已認證匯款銀行帳戶
- 選擇 Astera 收款銀行帳戶
- 輸入匯款日期
- 輸入匯款金額
- 輸入匯款人資訊／必要識別資料
- 選擇要分配的訂單；一筆匯款可分配至多張訂單

付款狀態至少包含：

- 待付款
- 待確認
- 已認列
- 對帳問題
- 已失效
- 已撤銷

所有狀態都要同時使用文字／圖示與顏色，不得只靠顏色判斷。

## 8. 響應式與可及性需求

### 驗收尺寸

- 390px 手機
- 768px 平板
- 1365px 桌面

### 所有頁面必須

- 不水平溢出
- 表單欄位不重疊
- 互動目標至少 44×44px
- 支援鍵盤 Tab 與清楚的 focus outline
- 支援 loading、empty、error、retry 狀態
- 支援 `prefers-reduced-motion`
- 圖片保留固定比例，避免載入時版面跳動
- 行動版商品列表維持 2 欄
- Dashboard 預覽區使用橫向滑動，不改成過長直向列表

## 9. 實作順序

1. 完成整站資訊架構與 Route map
2. 建立 Design Token、字體、間距、圓角、狀態與元件規格
3. 完成共用 Header、Footer、登入閘門與 RWD Shell
4. 完成首頁與商品列表
5. 完成商品詳情、購物車與 Checkout
6. 完成會員登入、會員資料與銀行帳戶
7. 完成付款回報與訂單狀態
8. 完成品牌頁、FAQ、客服入口
9. 完成 Owner Workspace
10. 完成 RWD、鍵盤、loading／empty／error／retry 驗收
11. 執行自動化測試與 production build

## 10. 每頁完成條件

每完成一個頁面，必須確認：

- 版面符合本文件順序與 Design Token
- 未登入／已登入狀態正確
- loading、empty、error、retry 狀態存在
- 互動按鈕有清楚文字與 focus
- 390px、768px、1365px 無水平溢出
- 不改動既有資料 Collection 與商業邏輯

## 11. 自動化驗收

每個頁面完成後執行：

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e` 或對應 Playwright 測試

Playwright 至少涵蓋：

1. 訪客瀏覽商品成功。
2. 訪客加入購物車前被導向 Google 登入。
3. 首次登入導向會員資料。
4. 五筆銀行帳戶上限與不可自行刪除。
5. 無銀行帳戶時無法付款，且可導向綁定頁。
6. 付款回報可選會員匯款帳戶與 Astera 收款帳戶。
7. 一筆匯款可分配至多張訂單。
8. 不同 Campaign 在 Checkout 正確拆單。
9. 未於截止前確認付款的訂單轉為失效。
10. Owner Workspace 需要正確權限才能進入。

## 12. Definition of Done

本次整站 UI/UX 改版完成的條件：

- 公開首頁看起來是 Astera 選物店，而不是 OMS 工具。
- 商品列表桌面 4 欄、手機 2 欄，商品圖片是主視覺。
- 訪客可瀏覽，但加入購物車前必須 Google 登入。
- 會員資料、最多 5 筆銀行帳戶、銀行匯款付款回報流程可操作。
- Checkout、Campaign 拆單、結單與失效規則維持現有商業邏輯。
- Owner Workspace 保留高效率營運資訊密度。
- 所有尺寸與狀態完成 RWD、可及性與 Playwright 驗收。
- TypeScript、ESLint、Unit Test、Build、Playwright 全部通過。
