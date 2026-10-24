---
'@cockatrice/datatrice': minor
---

Server capability gating, login rejection codes and the 3.1 protocol events.

`server.Selectors.supports(state, server.ServerCapability.X)` tells whether the connected Servatrice offers a 3.1 feature family (`REPORTS`, `MODERATION_TOOLS`, `CARD_ART`, `PLAYMATS`, `DECK_SHARING`, `DEVELOPER_ROLE`), inferred from the version string it identifies with, since the protocol has no feature list and `protocol_version` is 14 on both 3.0 and 3.1. Each family has its own minimum, down to the 3.1 beta that introduced it (card art beta.2; reports, moderation tools and playmats beta.8; developer role beta.12; deck sharing beta.13), and the 3.1.0 release outranks every beta. Unknown versions answer `false`. `parseServerVersion` and `serverSupports` are exported for non-store callers.

`loginFailed` now records the rejecting response code in the optional `server.loginFailureCode` (`getLoginFailureCode`), cleared on the next connection attempt and kept through the disconnect that follows a rejected login. `Event_GameLogNotice` `UNDO_DRAW_FAILED` appends desktop's "<player> failed to undo their last draw." to the game log; unknown notice types are dropped. `adjustMod` leaves a role unchanged when its flag is omitted, as Servatrice does (promoting to moderator no longer clears judge locally), and applies the new developer flag; new `getIsUserDeveloper` selector. A refused 3.1 query dispatches the `sessionCommandFailed` / `moderatorCommandFailed` signal (`SESSION_COMMAND_FAILED`, `MODERATOR_COMMAND_FAILED`) with the command, response code and target, so a view can show desktop's error state instead of loading forever.
