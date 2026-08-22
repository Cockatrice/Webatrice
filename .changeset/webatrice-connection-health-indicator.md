---
'@cockatrice/webatrice': minor
---

The TopBar connection dot now has a third state: amber for "Server not responding (Ns)".

Previously the dot was binary (green connected / red disconnected) and the transport killed quiet connections outright. With the transport now keeping silent connections open and reporting degraded health, the dot turns amber while pings go unanswered — with the silence duration in the accessible label — and recovers to green on the next pong. Players see honest degradation instead of a silent freeze followed by an unexplained bounce to login.
