---
'@cockatrice/datatrice': minor
---

Room and chat state for desktop-parity failure feedback.

**Room join failures.** `rooms.joinRoomFailed` is now a slice reducer: `rooms.joinRoomError` (`{ roomId, responseCode, failure? }`) holds the failed user-initiated join for the lobby's dialog (a failed autojoin, `userInitiated: false`, is left out as desktop shows no message for it), read with `rooms.Selectors.getJoinRoomError` and cleared with `rooms.Actions.clearJoinRoomError`.

**Room chat.** Messages from users on your ignore list are dropped as they arrive, history included, as desktop `TabRoom::processRoomSayEvent` does (inbound `addMessage` now goes through a `rooms/roomSayReceived` listener). A flood rejection appends a client notice line (`Message.notice === 'chatFlood'`); a message the server never answered appends a `'notSent'` line carrying `Message.failure`. Both dispatch `rooms.Actions.roomSayFailed` with the unsent text.

**Private conversations.** `server.privateChatNotices` records lines desktop `TabMessage` appends to a conversation: a rejected or unanswered message (recipient ignores you, recipient offline, flooding, or `'notSent'` with the `CommandFailure`) and the partner leaving or rejoining the server while a conversation is open. `server.Selectors.getPrivateConversation(state, name)` returns messages and notices in order; `server.Selectors.getIsUserOnline(state, name)` exposes known presence. `server.Actions.privateMessageFailed` carries the unsent text.

**A user's games.** `server.gamesOfUserStatus` tracks each "Show games" request as loading, loaded or failed (with the response code and `CommandFailure`), read with `server.Selectors.getGamesOfUserStatus`; `server.Selectors.getGamesOfUser` lists the games. Each game's type now resolves through its own room's game types; the merged map let one room's type ids shadow another's.
