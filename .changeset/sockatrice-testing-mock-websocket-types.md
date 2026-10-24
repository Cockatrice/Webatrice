---
'@cockatrice/sockatrice': patch
---

The `@cockatrice/sockatrice/testing` helpers `makeMockWebSocketInstance` and `installMockWebSocketHarness` now declare their return types, `UnitMockWebSocket` and `UnitMockWebSocketHarness`, both exported. The shapes are unchanged. Under Vitest 5 the inferred types named a type internal to Vitest, so the package's declaration build could not emit them.
