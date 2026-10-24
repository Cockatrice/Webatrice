---
"@cockatrice/datatrice": patch
---

Preserve room names returned with a user's games and register opened private chats so presence notices appear before the first message. Closing a private chat clears its conversation and stops presence notices until it is reopened.

Record private-message receipt times in the response handler and expose them through the message and conversation selectors for report chat logs. Private messages and their reducer actions require caller-supplied timestamps; the reducer never reads the clock.
