---
'@cockatrice/webatrice': minor
---

Rooms, chat and user-menu parity with desktop Cockatrice.

**Room permissions.** The rooms table shows a room's privilege level when its permission level is `none`, as desktop does, instead of always showing `none`.

**Room join errors.** A failed join is explained in the lobby with desktop's message (the room doesn't exist, you lack the permission, or an unknown error with its code), or with the timed-out / connection-lost reason when the server never answered, and leaves you there to retry. This replaces the generic join-room notice.

**Room chat.** Ignored users' messages no longer appear. Sending too fast shows desktop's "You are flooding the chat" line, and a message the server never answered shows "Message not sent" with the reason; either way the unsent text goes back into an empty input. Chat history received on joining a room shows each line's server time, like desktop.

**Private chat.** The conversation shows the partner's online state and notes when they leave or rejoin the server. A message the server rejects (they ignore you, they went offline, you are flooding) or never answers is explained in the conversation and the text comes back into the composer. While the partner is offline, or on your ignore list, the composer says why and keeps your draft instead of sending.

**Show a user's games.** Right-clicking a user (in user lists or on a name in chat) now offers *Show this user's games*, as on desktop, ahead of the moderator section. It lists the games they are in, with their room, and lets you join or spectate (judges also get the judge variants) through the same flow as a room's game list: password prompt, full games joined as a spectator, and the server's error messages (or the timed-out / connection-lost reason). Like desktop, it is available only while the user is online and asks you to join the game's room first.
