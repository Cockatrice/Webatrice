---
"@cockatrice/datatrice": minor
---

Add typed game-log descriptors (`kind` and `params`) and persist them as
`GameMessage.descriptor` so hosts can translate events and classify their tone
without inspecting English text. Existing text-only entries remain supported.

`LogEntry.text` is deprecated, marked with JSDoc `@deprecated`, and retained for
one release together with its legacy English segments. `classifyLogTone` is
also deprecated in favor of `logTone(entry.kind)`. No text field is removed.

Game-log and game-clock actions now capture `timeReceived` in their payload at
action creation, preserving existing action-creator calls and allowing explicit
timestamps. Reducers use that captured value rather than reading the clock.

Match desktop departure behavior: preserve the stored name verbatim, including
an empty name, and ignore events for missing players. This replaces the former
leave-only `Unknown player` fallback (desktop `message_log_widget.cpp:444` and
`game_event_handler.cpp:469`).
