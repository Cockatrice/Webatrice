---
'@cockatrice/datatrice': minor
---

Dev-mode freeze guard: in-place mutation of a stored protobuf message now throws instead of failing as silent staleness.

**The hazard.** Immer can't draft protobuf-es messages (proto2 builds them with `Object.create(prototype)` for field presence, so `isDraftable` skips them), so a reducer writing `card.x = y` on a stored message goes untracked: the reference never changes and memoized selectors keep serving the cached value. The bug class is real — the clone-and-reassign hardening pass (#49) fixed four shipped instances (`counterSet`, `adjustMod`, `replayModifyMatch`, `playerPropertiesUpdated`) that were found months later, backwards from stale-UI symptoms. With RTK's dev invariant checks off (they deep-walk proto-laden state), nothing guarded the convention.

**The guard.** A dev-only `freezeMessagesMiddleware` in `createStore` deep-freezes every protobuf message (including nested messages and repeated-field arrays) as it enters state, after each dispatch. Violating writes now throw a `TypeError` at the offending line in dev — including writes from consumer code holding selector-returned references, which Immer's container auto-freeze never covered. Freezing happens at state entry, never at creation, so the build phase (bare `clone()` outputs patched before dispatch, optimistic plain-spread cards) stays mutable until a dispatch lands the object in state.

**Bounded cost, dev only.** A module-scope `WeakSet` skips already-visited nodes; Immer's path-copying preserves unchanged subtree identity, so each dispatch re-walks only newly created nodes — O(changed path), not the O(state) that forced the invariant checks off. Production builds compile the middleware to a passthrough (`process.env.NODE_ENV`, the RTK convention — bundlers statically replace the expression).

**Validated at the bridge seam.** A new integration spec drives the response bridge (`attachResponseHandlers`) through the game hot paths — join snapshot, draw, move, `SetCardAttr` clone semantics, bulk untap, reveals with auto top-reveal, counters, player properties, both optimistic-echo branches (re-key migration and in-place position patch), the rooms `updateGames` batch and sparse `UPDATE_ROOMS` merges — plus a whole-store sweep asserting no reachable message is left unfrozen. All probes are proven causally tied to the middleware: running the suite with the guard compiled out fails every test.
