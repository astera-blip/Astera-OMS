# Payment Account Review and Workspace Cleanup Design

## Goal

讓會員可以在既有「需要重新驗證」帳戶上重新輸入資料並恢復可付款狀態；讓 Owner 付款清單把已拒絕回報集中收納；移除 Owner 重複的工作區總覽入口。

## Approved behavior

1. **會員舊帳戶重新驗證**
   - 只對登入會員自己的 `needsReverification` 帳戶顯示重新驗證表單。
   - 表單要求銀行代碼、完整銀行帳號與匯款人姓名。
   - Server 重新產生 KMS 帳戶識別，沿用原 member payment account document ID 更新；不回傳完整帳號、fingerprint 或 canonical input。
   - 歷史 `payments` 快照不修改；後續付款只能使用新的 verified identity。

2. **Owner 拒絕付款收納**
   - 付款 API、狀態值與稽核紀錄維持不變。
   - 主清單顯示可處理的 `pendingReview` 回報。
   - `rejected` 回報集中在預設收合的「已拒絕（N）」區塊；展開後仍可點選查看唯讀細節。
   - 確認／撤銷紀錄保留在歷史區，不與待確認項目混淆。

3. **Owner 工作區入口**
   - Owner 開啟 `/workspace` 時導向 `/workspace/products`。
   - Owner 左側移除會重複呈現右側卡片的「工作區 Workspace」項目。
   - Partner 的商品草稿／審核入口與 Helper 的任務首頁保留；角色路由限制不變。

## Data and security constraints

- 不新增 Firestore collection 或 migration。
- Re-verification route 必須驗證 `memberUid === claims.uid`，且只更新該文件的身份、payer name、verification/status 與 audit-safe timestamps。
- Duplicate／last-five collision review 仍使用既有 notification event contract；不保存完整帳號。
- Reject grouping 是 presentation-only；不改 payment/reconciliation/refund transaction semantics。

## Acceptance criteria

- Legacy account card has a working re-verification form and receives a masked `verified` snapshot after a successful PATCH.
- Unauthorized member cannot patch another member's account; malformed input does not write.
- Rejected payment cards no longer appear in the pending list and are available under a collapsed count section.
- Owner `/workspace` no longer renders duplicate overview cards and lands on `/workspace/products`; Partner/Helper workspace behavior remains covered.
