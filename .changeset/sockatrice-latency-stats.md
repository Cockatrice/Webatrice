---
'@cockatrice/sockatrice': minor
---

Command round-trip times (Cockatrice #7153). `ProtobufService` times every answered command from send to response in a 64-sample rolling window and reports the last, median, 95th-percentile and maximum round trip, plus the window itself, through the new optional `ISessionResponse.updateLatencyStats(stats, samplesMs)` at most once a second. The window is cleared, and zeroed stats reported, when the connection drops. New `WebsocketTypes.LatencyStats` type.
