# @cockatrice/webatrice

## 4.0.3

### Patch Changes

- 0509fcf: Battlefield scrolling and arrow anchoring improvements: stack columns now scroll vertically when card count overflows the available height, the three battlefield lanes for one player share a single horizontal scrollbar (so columns stay aligned across rows instead of drifting independently), and the arrow overlay re-anchors in real time on any scroll via a capturing scroll listener on `window` (rAF-coalesced).
- 0509fcf: The player name in each side's info panel is now the dropdown for choosing which player occupies that slot. Clicking the name (with a caret affordance beside it) opens a menu of all players in the game; the previous standalone slot-selector dropdowns above the board have been removed.
- 0509fcf: Fix four related player-slot issues in the game view:

  - A lone player (e.g. host who readies before anyone joins) no longer renders on both sides of the board. Slot B stays empty until a second player is seated, and the board grid drops the hand-zone row so the battlefield fills the space.
  - Slot defaults now follow the order players joined, not numeric `playerId` order.
  - The hand zone no longer renders for spectators (it's the local-player's hand UI; spectators are always viewing someone else).
  - Selecting a player who is already in the other slot now swaps the two slots instead of collapsing both onto the same player.

- 0509fcf: Themed permanent scrollbars on battlefield, hand, and stack zones. Horizontal scrollers use `overflow-x: scroll` so the thin themed scrollbar is permanent — no layout shift on overflow toggle. The stack column uses `overflow-y: auto` + `scrollbar-gutter: stable both-edges` so reserved gutters stay symmetric and cards remain visually centered. Stack column widened to 96 px (1.5× the card width, matching Cockatrice's `StackZone::boundingRect`); player board grid track updated accordingly. Hand zone moves horizontal padding onto the inner scroll container so the scrollbar spans the full width.

## 4.0.2

### Patch Changes

- 3fddac1: Fix: right-click-dragging an arrow between cards no longer opens the target card's context menu on release. The post-mouseup `contextmenu` suppression now runs in the capture phase and calls `stopPropagation()`, so the event is intercepted before React's delegated root listener can open the card menu.
- d075da6: Drag-start latency fixes for the game board:

  - Left-click drag activates on the first pointermove (`distance: 0`) — eliminates the perceptible "dead zone" between mousedown and drag preview, while pure clicks (zero-motion press→release) still flow through to the card click handler. The previous `{ distance, delay, tolerance }` combined constraint was inadvertently canceling fast-flick drags before they could activate.
  - `<img draggable={false}>` + `user-drag: none` on `.card-slot` and `.card-slot__image` suppress the browser's native HTML5 image-drag that was producing a "no-drop" cursor during the pre-activation window.
  - `DragOverlay` snap-back animation disabled (`dropAnimation={null}`).
  - `CardSlot` split into a thin wrapper (owns the dnd-kit context subscription via `useDraggable`) and a memoized `CardSlotContent` inner (renders the image, name/annotation overlay, P/T, counters). On drag activation, the wrapper re-renders but the inner content skips for cards whose visual state didn't change — meaningful reduction in React commit work with ~60 cards on a typical board.
  - Right-click arrow drag threshold `ARROW_DRAG_THRESHOLD_PX` set to 4 (now independent from the left-click sensor distance, which has different ergonomics).

- 0150bd0: Game feature cleanup — collapse over-engineered state and prop drilling, no behavior change:

  - `useGameArrowInteractions`: `pendingArrow` and `pendingAttach` merged into one `Pending` discriminated union; the ref-flag + always-on `contextmenu` listener replaced by a one-shot `{ once: true }` listener registered at right-drag mouseup.
  - `useGameDnd`: removed the `activeCard` state mirror, `handleDragStart`, and `handleDragCancel`. `<CardDragOverlayHost>` reads the active draggable from dnd-kit's own context via `useDndContext()`.
  - New `GameInteractionContext` carries the 6-handler bag (`onCardHover`, `onCardClick`, `onCardContextMenu`, `onCardDoubleClick`, `onZoneClick`, `onZoneContextMenu`). `PlayerBoard`, `Battlefield`, `BattlefieldStackColumn`, `HandZone`, `StackColumn`, `PlayerInfoPanel`, and `AttachmentStack` stop forwarding these as props. Context value is memoized so existing `memo()` boundaries (AttachmentStack, BattlefieldStackColumn) still skip re-renders. Slot-specific handlers (`onPlayerContextMenu`, `onHandContextMenu`) remain explicit props.
  - `attachmentSlotLayout(N, index)` added to `gridMath.ts`; `AttachmentStack` becomes a thin render loop instead of duplicating parent/child positioning math inline.

- ff262a9: Game board: reduce drag-time re-renders by memoizing `BattlefieldStackColumn` and `AttachmentStack`, stabilizing `BattlefieldRow`'s droppable data, and collapsing the per-card inline callback wrappers in `Game`, `HandZone`, and `AttachmentStack` to bare references via a unified `CardSlot` handler signature `(ownerPlayerId, zone, card[, event])`. Also: extract battlefield grid math out of `playCard`, `useBattlefield`, `useGameDnd`, `BattlefieldStackColumn`, and `AttachmentStack` into `gridMath` (new helpers: `getStackColumn`, `getSubPosition`, `gridXFromColumn`, `nextAvailableColumn`, `attachmentStackFactor`, `effectiveCardDimensions`, `roundPercent`).
- f27a236: Stack zone now behaves like the other zones: cards on the stack are real `CardSlot`s, so right-click opens the card context menu, they can be arrow sources and targets, they emit hover/click/double-click into the shared `GameInteractionContext`, and they are draggable. The stack column itself is also a drop target — drag a card from hand or battlefield onto the stack to move it there (`moveCard` with `targetZone=STACK`). The drop zone is gated on `canAct`, so the opponent's stack does not light up.

## 4.0.1

### Patch Changes

- 2d235dc: Consolidated E2E docker infrastructure across the monorepo:

  - **Shared compose stack.** E2E docker stacks merged into a single `docker/servatrice/` directory at the monorepo root. Each package keeps only a tiny per-package env file (compose project name + host port) and invokes the shared compose via `docker compose --env-file <pkg>/.env.e2e -f ../../docker/servatrice/docker-compose.e2e.yml ...`. One servatrice image tag, one schema, one ini.
  - **`servatrice.sql` from the image.** The init SQL now comes from the pinned `ghcr.io/cockatrice/servatrice` image (extracted by a `servatrice-sql` sidecar into a shared volume mounted at `/docker-entrypoint-initdb.d/`) instead of the Cockatrice submodule. Image tag is the single source of truth — schema and binary can't drift. The submodule still materializes `libcockatrice_protocol/` for proto generation.
  - **Image tag in env.** The servatrice image tag moved out of `docker-compose.e2e.yml` into the root `.env.e2e` (substituted via `${SERVATRICE_IMAGE}`). Bumping the Servatrice release is now a one-line edit at the monorepo root.
  - **Env files at package root.** Per-package env files moved from `packages/<pkg>/e2e/docker/.env` to `packages/<pkg>/.env.e2e`. The `.env.e2e` suffix (not plain `.env`) prevents Vite/vitest from auto-loading the compose vars during dev/test/build.

  After pulling, run `docker volume prune` once to clean up the old project-prefixed volumes (`webatrice-e2e_webatrice_e2e_mysql`, `sockatrice-e2e_cockatrice_e2e_mysql`); the new stacks use `*_mysql_data`. The shared ini sets `maxnamelength=16` (was 12 for Sockatrice) — Sockatrice's 10-char generated usernames still fit, no behavioral change.

- ecdcb35: Country flag SVGs now come from the `flag-icons` npm package instead of the `vendor/cockatrice` submodule. Refresh with `npm update flag-icons` — no submodule bump required.
- Updated dependencies [73513b3]
  - @cockatrice/datatrice@4.1.0

## 4.0.0

### Major Changes

- **Joined the unified monorepo release flow.** Webatrice now lives at `packages/webatrice/` alongside `@cockatrice/sockatrice` and `@cockatrice/datatrice`, with all three linked at v4.0.0 via [Changesets](../../.changeset/README.md). Subsequent changes that touch any of the three bump all three to the next shared version.
- **Versioning is now Changesets-driven.** The previous manual `npm version` bump in [`release.yml`](../../.github/workflows/release.yml) is gone; Changesets writes the version into `packages/webatrice/package.json` via the "Version Packages" PR. The downstream build / tarball / GitHub Release / deploy pipeline is unchanged in shape but reads the version from the manifest and tags releases as `@cockatrice/webatrice@<version>` to match the libraries' tag format.
- **Webatrice stays private.** Not published to GitHub Packages or any other registry; tarball-on-Release for `deploy.yml` remains the only distribution channel. Changesets honors `private: true` + `privatePackages.version: true` to version + tag without publishing.

### Notes

- Root manifest is now `cockatrice-web-stack` (private, version 0.0.0) — a thin orchestration package that owns `workspaces`, the shared `prepare` (submodule init + sockatrice codegen + husky), and a few cross-workspace convenience scripts. All app-specific scripts, dependencies, browserslist config, and configuration files now live under `packages/webatrice/`.
- Husky pre-commit hook updated to invoke `npm run -w @cockatrice/webatrice translate` and stage `packages/webatrice/src/i18n-default.json`.
