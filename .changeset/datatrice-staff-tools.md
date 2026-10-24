---
'@cockatrice/datatrice': minor
---

Store the results of the Cockatrice 3.1 staff tools.

`attachResponseHandlers` now implements the moderator investigation, card-art rule and developer responses. `server.staff` holds one active investigation (`ReportUserInfo`, alts, sessions), staff last logins, card-art rules and the latest server stats snapshot, read through `getUserInvestigation`, `getModeratorLastLogins`, `getCardArtRules` and `getServerStats` (lists are `null` until loaded). `userAvatarRemoved` drops the cached avatar of that user. `DeveloperResponseImpl.commandFailed` dispatches a new `developerCommandFailed` signal (`server.Types.DEVELOPER_COMMAND_FAILED`), alongside the moderator and admin ones. `ServerCapability` is also exported flat from the package root, because the namespace bundle kept only its type. A password reset's temporary password never enters the store.

Consumers dispatch userInvestigationStarted({ userName }) before the three investigation requests. This replaces server.staff.investigation with that target and empty results, immediately discarding earlier private data. Selectors and response handlers ignore other targets, keeping late private payloads out of results and action snapshots.

Card-art add/remove acknowledgements are signals (CARD_ART_RULE_ADDED / CARD_ART_RULE_REMOVED); only the authoritative list response changes the cached rules. Webatrice re-lists after mutations, as desktop does.
