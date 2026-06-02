# @cockatrice/webatrice

## 4.1.5

### Patch Changes

- db03477: Let judges act on any player's cards, routing every action through Command_Judge.

  A judge can already join/create a game as judge, and drag opponents' cards, but
  the card context menu was hard-gated to owned cards. The writeable menu (play,
  move, tap, flip, face-down, doesn't-untap, P/T, annotation, counters, peek,
  attach) now opens on any card for a judge — parity with Cockatrice's
  `writeableCard = getLocalOrJudge()`.

  Because the per-card commands (`setCardAttr`, `flipCard`, `incCardCounter`,
  `setCardCounter`, `attachCard`, `revealCards`) carry no player id, a judge acting
  on a card they don't own now wraps the command in `Command_Judge(target_id=owner)`
  so the server executes it as the owner — exactly as Cockatrice's centralized
  `PlayerActions::sendGameCommand` does. `moveCard` is wrapped too (for correct
  forced-by-judge attribution and owner-context permission checks). Play is wrapped
  as well: a judge plays a foreign card onto its owner's table (the play path now
  targets the owner tree rather than the local player), matching Cockatrice — where
  play is gated only by `getLocalOrJudge()` with no extra restriction.

  The owner-routing and judge-wrap rules are applied uniformly across _every_
  interaction path, not just the card menu: drag-and-drop, multi-select bulk tap/move,
  double-click tap, double-click play, and the "Move to library at position…" dialog
  all resolve the move target via the owner tree and wrap foreign-card commands the
  same way. Own-card actions are unchanged and still sent bare.

## 4.1.4

### Patch Changes

- d382725: Make zone-view popups (graveyard / exile / library) full drag participants and
  route zone moves to the card's owner, matching Servatrice.

  Cards in a popup are now draggable — out to the battlefield, into another open
  popup, or reordered in place — and a popup is itself a drop target, so cards can
  be dragged into it. Moves into a non-table zone (graveyard, hand, exile, library)
  now target the card's owner tree rather than the acting player: a controlled
  opponent card sent to a non-table zone lands in the owner's zone, never a third
  party's, mirroring Servatrice's move rules (`server_abstract_player.cpp`). TABLE
  keeps cross-player targeting so giving a card to an opponent (a control-change)
  still works.

  The open "View library" popup now stays in sync with the deck: when a card
  leaves it the snapshot is pruned and re-indexed, and dragging within the popup
  reorders the library — both mirroring Cockatrice's live `ZoneViewZone`.

  Drag collision detection now respects the popup's stacking: because a zone-view
  popup floats above the board, a card dropped onto it routes into the popup's zone
  (rather than the board droppable underneath), and a card dropped on visible board
  lands there even when a popup overlaps elsewhere on screen.

## 4.1.3

### Patch Changes

- 609b97b: Size the hand zone proportionally to the board instead of a fixed 176px height.
  In all-hands (omniscient) games the inline hand previously consumed roughly half
  of each player's cell — in 3-player mode it dominated the battlefield. Each inline
  hand now takes 25% of its cell, leaving the battlefield ~75%, and the bottom hand
  bar scales with the board height (clamped so it stays usable on short/tall
  viewports). Hand cards already size to fill the zone, so they scale with it.

## 4.1.2

### Patch Changes

- dcfd99b: Render every seated player at once in an adaptive board grid that sizes itself
  to the player count: a lone player's battlefield fills the screen, 2-3 players
  stack vertically, and 4+ players form a 2-column grid that grows rows (2×2,
  2×3, …).

  The layout is a port of Cockatrice's `GameScene::rearrange()`: seated players
  sit in a cyclic ring in join order, the ring rotates so the local player anchors
  the bottom-left cell, and seats wind up the left column then down the right so
  the around-the-table order is preserved relative to you. Every row above the
  bottom is mirrored, and conceded players drop out of the grid. Hands show as a
  single bottom bar for the local player, switching to an inline hand per board
  when more than one hand is visible (omniscient games). This replaces the old
  two-slot board and its per-board player-swap dropdowns.

## 4.1.1

### Patch Changes

- 63e77cb: Fix the View Library flow so the deck's cards are actually revealed.

  Opening "View library…" now sends `Command_DumpZone` and consumes the
  `Response_DumpZone` card list the server returns to the requester, routing it
  into the store (new `ZoneEntry.revealedCards` with `zoneViewRevealed` /
  `zoneViewCleared` reducers and a `getRevealedCards` selector). The popup reads
  the revealed cards from the store and renders them face-up, and a Cockatrice-
  parity "Shuffle on close" checkbox (deck only, default on) sends
  `Command_Shuffle` when the view is closed.

  Also stops pre-bundling the `@cockatrice/*` workspace packages in webatrice's
  vite `optimizeDeps` so `npm run start` reliably reflects dependency rebuilds
  instead of serving a stale pre-bundle.

- Updated dependencies [63e77cb]
  - @cockatrice/sockatrice@4.1.0
  - @cockatrice/datatrice@4.2.0

## 4.1.0

### Minor Changes

- b44419f: Rubber-band multi-select on the battlefield, stack, hand, and open zone-view dialogs, with bulk tap/untap and move-to-zone.

  - Drag an empty-space box to select multiple cards; Ctrl/Shift adds to the current selection. Dragging over card art/text no longer triggers the browser's native text selection.
  - Hit-testing is scoped to the zone the drag started in (`[data-zone-box-select]` on the battlefield, stack, hand, and zone-view dialog body), so a drag in one zone never selects cards in another and drags inside a popup work correctly. The band overlay renders `position: fixed` above dialogs and is clamped to its origin zone so it never paints into neighboring zones.
  - Collapse-unless-selected governs every single-card interaction (click, double-click, drag-start, right-click): acting on a card outside the selection collapses to it; acting on a card already in the selection preserves it.
  - Bulk actions reach the existing card context menu — Tap/Untap uses Cockatrice's collective rule (untap-all only if every selected TABLE card is tapped, else tap all) and Move-to-zone groups by source and emits one `moveCard` per group.

## 4.0.10

### Patch Changes

- 17ea698: Pipeline and bundle cleanup:

  - Load the token library via a static `@app/services` import in the create-token dialog — the previous dynamic import was ineffective (the barrel is statically imported app-wide) and tripped a Vite build warning.
  - Split heavy third-party vendors into separate chunks so the entry bundle stays under the size-warning limit and vendor code caches across deploys.
  - Drop obsolete stub `@types` devDependencies (the real packages ship their own types) and repin `actions/cache` to a Node 24-compatible release ahead of GitHub's June 2026 Node 20 removal.

## 4.0.9

### Patch Changes

- 85b9e3c: Replace `src/server-props.json` with `public/version.txt`. The commit SHA is now written to a real static asset the deployed site exposes at `/version.txt`, and the in-app version footer fetches it at runtime via a new `useVersion()` hook instead of importing a bundled JSON. Restores the deploy smoke test's ability to verify which commit is actually live.

## 4.0.8

### Patch Changes

- c19c819: Hand and stack zones now support drag-and-drop reordering. Dragging a card within your hand or side-pile sends a same-zone `Command_MoveCard` with the target index, and a bright pale-yellow insertion bar lights up in the gap where the card will land — on the after-edge of the hovered slot when moving forward, on the before-edge when moving back. A new `cardMovedInSameZone` reducer handles the intra-zone splice without going through the cross-zone path, so no arrow sweep or attachment reparent fires on a simple reorder.

  Under the hood, `useGameDnd.handleDragEnd` is split into a `classifyDrop` dispatcher plus small `resolveTableGridX` / `sendMoveCard` helpers. The DndContext also gets a custom `collisionDetection` that prefers reorder-slot droppables over their enclosing zone — without it, a 64×88 stack slot loses dnd-kit's default IoU tiebreaker against the wider stack column whenever the 146×204 drag overlay is in flight, which is why stack reorders silently failed before this change.

## 4.0.7

### Patch Changes

- fa879b2: Untap-all now matches Cockatrice's wire protocol. Pressing F5 or double-clicking the Untap phase sends a single bulk `Command_SetCardAttr` with `card_id = -1` instead of one command per tapped card, so peers see every card untap in one frame and the chat log shows a single "untaps their permanents" line instead of N per-card lines. The inbound listener detects the bulk variant via `isFieldSet` (Servatrice omits `card_id` on the broadcast event for bulk operations) and applies the attribute to every card in the named zone in one reducer pass via a new `cardFieldsUpdatedBulk` action, so the local Webatrice UI now refreshes immediately on bulk untap without requiring a page reload.
- fa879b2: Consolidated all thin-scrollbar styling into a single reusable `.scrollable` class (in `styles/thin-scrollbar.css`) driven by two CSS custom properties — `--thin-scrollbar-color` and `--thin-scrollbar-gutter` — plus a `.no-gutter` modifier for elements that shouldn't reserve gutter space. Every scrolling container in the app now opts in via this class: the five game-area scroll regions (card preview back, game log, hand zone, stack column, battlefield), the in-game dialogs (zone view, sideboard, create-token), and every page-level scroll surface (app routes, account, server, login, room, logs, game selector, settings panel). The old `.overflow-scroll` utility class and its scattered per-component `scrollbar-width` / `scrollbar-color` / `::-webkit-scrollbar*` rules are gone — scrollbars are now thin, translucent, and consistent across the app, with stable gutter (no layout shift) on the elements that need it.
- fa879b2: Right-sidebar scrollbars are now stable and visually consistent. The card preview no longer scrolls at the container level — when the flipped backside has long oracle text, the scrollbar lives inside the back face only, so flipping back to the front never reveals a stray scrollbar over the card image. The in-game GameLog gains the same thin dark scrollbar treatment so the two stacked panels read as one surface.

## 4.0.6

### Patch Changes

- 5909c5b: Consolidated all thin-scrollbar styling into a single reusable `.scrollable` class (in `styles/thin-scrollbar.css`) driven by two CSS custom properties — `--thin-scrollbar-color` and `--thin-scrollbar-gutter` — plus a `.no-gutter` modifier for elements that shouldn't reserve gutter space. Every scrolling container in the app now opts in via this class: the five game-area scroll regions (card preview back, game log, hand zone, stack column, battlefield), the in-game dialogs (zone view, sideboard, create-token), and every page-level scroll surface (app routes, account, server, login, room, logs, game selector, settings panel). The old `.overflow-scroll` utility class and its scattered per-component `scrollbar-width` / `scrollbar-color` / `::-webkit-scrollbar*` rules are gone — scrollbars are now thin, translucent, and consistent across the app, with stable gutter (no layout shift) on the elements that need it.
- 5909c5b: Right-sidebar scrollbars are now stable and visually consistent. The card preview no longer scrolls at the container level — when the flipped backside has long oracle text, the scrollbar lives inside the back face only, so flipping back to the front never reveals a stray scrollbar over the card image. The in-game GameLog gains the same thin dark scrollbar treatment so the two stacked panels read as one surface.

## 4.0.5

### Patch Changes

- 9ad35fb: Arrow heads now have a thin black outline so they stay visible against same-colored cards, and all arrow heads render above all arrow lines so a crossing arrow body never obscures another arrow's head.
- 4773f73: Arrow interactions: targets now get a red outline on hover while drawing an arrow, matching the source card's outline so you can see exactly which card the arrow will land on. Arrows drawn from a card in hand to a card on the battlefield now actually create the arrow (in addition to playing the card from hand) — matching desktop Cockatrice behavior. Both right-click-drag and click-to-target paths are covered.
- 7abdc95: Card preview gains a flip-to-info view. An info icon in the top corner of the in-game card preview now flips the card around its vertical axis with a subtle scale dip, revealing Cockatrice-style attributes (Name, P/T, Cost, CMC, Identity, Colors, Type, Side, Layout) plus oracle text sourced from the local Dexie card database. The flipped state persists across hover changes; the preview pane itself scrolls when text is long (thin scrollbar), and the card image now sizes from the available container space rather than hardcoded pixels.
- a998d0e: Click a card to select it. Focused cards get a distinct blue outline and pin the right-sidebar CardPreview so you can move your mouse around without losing the preview. Works for cards in hand, on the battlefield (including attachments), on the stack, and inside library / graveyard / exile popups. Native focus model drives the behavior: clicking another card or anywhere outside clears the selection. Hovering a zone face (library / graveyard / exile) no longer flashes its top card into the preview pane — only cards themselves do.
- 48d5206: Player-targeted arrows now anchor to the rim of the life counter instead of its center, so the arrowhead points at the life circle rather than sitting on top of it. The line endpoint is pushed outward by the arrowhead's tip overshoot so the visual apex clears the rim cleanly. Card-targeted arrows are unchanged.
- 7112785: Player panel header is fully clickable: anywhere on the header opens the player dropdown (was previously only the name button), and the pointer cursor now covers the entire arrow-drop target area.
- 6c8484f: Arrows can now be drawn from a card to a player. The player info panel header acts as the drop/click target during a right-click-drag or pending arrow click; the rendered line anchors to the life counter. Several supporting fixes were needed to make the round-trip work:

  - proto2 field presence: `Command_CreateArrow` now omits `targetZone`/`targetCardId` for player targets so Servatrice routes the command via `has_target_zone()`/`has_target_card_id()` (omitting → player) rather than treating the empty defaults as a card lookup.
  - Live `arrowCreated` reducer assigns the raw `ServerInfo_Arrow` proto into the store instead of `{ ...arrowInfo }`. Spreading a bufbuild proto2 message drops unset optional fields entirely, which caused live player-targeted arrows to land in state without `targetZone`/`targetCardId` and silently fail to render until the next game-state refresh.
  - The cardMoved arrow-cleanup sweep now only runs on actual cross-zone moves, so repositioning a card within the battlefield no longer locally deletes its attached arrows.

- 7ba0317: Removed the right-sidebar "Rotate 90°" button. The toggle was a CSS `transform: rotate(90deg)` on the whole board and was mis-attributed to desktop's `Player::actRotateLocal` — that desktop action actually rotates **player seating order**, which Webatrice already exposes via the slot-A/slot-B player dropdowns. The board no longer spins.
- 6cc2d6f: Arrows created from the Cockatrice desktop client now render with a visible line, not just the arrowhead. Cockatrice's C++ color helper omits the alpha field on the wire, which bufbuild surfaces as `0`; the overlay now treats unset alpha as fully opaque.

## 4.0.4

### Patch Changes

- 6e253cb: Render both player hands when the game's `spectators_omniscient` flag is on. Seated players continue to see their own hand at the bottom and now also see the opponent's hand at the top; spectators see both hand zones (previously they saw none). Hand zones render upright in both slots — no rotation — so all card art is readable from the viewer's perspective. The grid layout collapses cleanly when one or both hands are hidden.

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
