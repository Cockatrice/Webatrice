---
'@cockatrice/datatrice': minor
---

State for user reports and the moderation queue (Cockatrice 3.1). `server.reports` holds the caller's reports and the moderator queue as id lists over shared rows, full report details with chat log and comment thread, queue statistics and the last replay fetched by game id, with selectors (`getMyReports`, `getReportQueue`, `getReportDetails`, `getReportQueueStatusCounts`, `getReportStats`, `getReportReplay`, …). Assign and resolve confirmations update the stored row. A new download request drops the stored replay. Report-read failures raise the new `sessionCommandFailed` signal (`Types.SESSION_COMMAND_FAILED`), and `Types` gains `REPORT_ASSIGNED`, `REPORT_RESOLVED` and `REPORT_REPLAY_DOWNLOADED` so views can react to those answers. The reported user's history is the Moderation page's `ReportUserInfo` lookup, read with `getUserInvestigation`. `REPORT_RESOLVED` / `REPORT_COMMENT` notifications also raise `getLastReportNotice`, so views can pop up and refresh. `server.filterReports`, `countReportStatuses` and `isReportOpen` mirror desktop's queue filter and gating.

Game chat lines (`GameMessage`) now carry the optional `senderName` captured when the line arrived, so a report's attached chat keeps a player who has since left. `games.Selectors.getMessages` returns `GameMessage[]` for an unknown game instead of a card-typed empty array.

`ReportStatus` is also exported from the package root, like `ServerCapability`: inside the `server` namespace the bundler emits a const-and-type pair as a type only.
