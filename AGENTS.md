<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Execution Rules

- 完成一個小批次或通過一次驗證，不代表整個任務完成。
- 若目前任務清單仍有可執行項目，應直接繼續，不要等待使用者說「繼續」。
- 測試失敗時，應先自行診斷、修復並重跑。
- 只有需要產品決策、額外權限、外部憑證、不可逆操作或確認無法自行排除的阻塞時，才詢問使用者。
- 最終回覆前必須核對本回合的完成條件。
- 不得用「我接下來會做」取代實際執行。
- 若因執行限制必須中止，必須更新執行計畫與交接紀錄，留下下一個精確可執行步驟。
