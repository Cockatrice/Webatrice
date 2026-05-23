---
applyTo: "packages/datatrice/**/*.spec.ts,packages/datatrice/**/*.spec.tsx,packages/datatrice/integration/**"
---

# Testing instructions

## Test fixtures

`@cockatrice/datatrice/testing` re-exports Redux state-shape factories — use these to seed `preloadedState` for unit tests. **Proto message builders live in `@cockatrice/sockatrice/testing`**, not here. `makeUser` / `makeGame` exist in both `fixtures/rooms` and `fixtures/server`; the rooms-flavoured versions carry the richer defaults (`gameId`, `roomId`, `description`) and are the canonical export at the barrel. Specs that need the leaner server-flavoured `makeGame` import directly from `./fixtures/server`.
