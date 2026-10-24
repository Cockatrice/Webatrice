---
'@cockatrice/datatrice': minor
---

Implements Sockatrice's new command-failure callbacks as signal actions carrying the response code and transport reason: `server/deckListFailed`, `deckDownloadFailed`, `deckUploadFailed` and `rooms/joinRoomFailed`, `createGameFailed`. `rooms/joinRoomFailed` carries `userInitiated` (new `JoinRoomFailedPayload` type). `moderatorCommandFailed` and `adminCommandFailed` now carry the transport reason too. New `getNotifications` and `getServerShutdown` selectors expose the `Event_NotifyUser` and `Event_ServerShutdown` messages the server slice already stored.
