---
"@cockatrice/sockatrice": patch
---

Settle pending commands synchronously before retiring a client, isolate throwing failure callbacks, and prevent old-session command IDs and re-entrant sends from affecting a replacement connection.
