---
'@cockatrice/sockatrice': minor
---

Move to the Cockatrice master (3.1) protocol and cover every command it adds.

The vendored protocol is bumped from 3.0.0 to Cockatrice master `add65ca`; `PROTOCOL_VERSION` stays 14 (unchanged on desktop and Servatrice). New command builders: moderator card-art rules, `getUserSessions`, `getUserAlts`, `getModeratorLastLogins`, `removeUserAvatar` and the moderation queue (`reportList`, `reportAssign`, `reportResolve`, `reportUserInfo`, `reportStats`, `replayDownloadByGameId`); admin `resetUserPassword` and a `shouldBeDeveloper` flag on `adjustMod`; a new `request.developer` scope (`DeveloperCommands.getServerStats`, developer-family `viewLogHistory`) backed by `ProtobufService.sendDeveloperCommand`; session `report`, `reportMyList`, `reportDetails`, `reportAddComment`, `setCardArtParams`, deck share links and public decks, plus `isPublic` / `colorIdentity` on `deckUpload`; game `setPlaymat`. `Event_GameLogNotice` is registered.

Results route through new `IWebClientResponse` methods (and an optional `developer` scope). They are all optional, so existing implementations keep compiling. One-shot dialog submissions (`report`, `reportAddComment`, `setCardArtParams`, `resetUserPassword`) take `onSuccess` / `onFailure(responseCode)` callbacks instead; a password reset's temporary password goes only to the caller. A refused 3.1 query reaches the scope's new optional `commandFailed(command, responseCode, target)` on `ISessionResponse`, `IModeratorResponse` and `IDeveloperResponse`, with the command named by the exported `SessionCommandName`, `ModeratorCommandName` and `DeveloperCommandName` unions.

Login maps `RespPasswordChangeRequired` and `RespServerFull`, and `ISessionResponse.loginFailed` now receives the rejecting response code (optional parameter).
