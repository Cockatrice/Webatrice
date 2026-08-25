# @cockatrice/webatrice

## 5.3.0

### Minor Changes

- f2ac3f1: Sort user and game lists using the active UI language's collation instead of the OS/browser default.

  **datatrice.** `SortUtil` now accepts an optional BCP-47 `locale` (per-locale `Intl.Collator` cache; `undefined` keeps the environment default). The server slice gains a `locale` field and a `setLocale` action (preserved across `initialized`/`clearStore`/`disconnected` resets so it survives a reconnect), and the memoized sorted selectors (`getSortedUsers`/`getSortedBuddyList`/`getSortedIgnoreList`, `getSortedRoomGamesBase`/`getSortedRoomUsers`) take `locale` as an input so a language change re-collates immediately rather than waiting for the next roster/sort change.

  **webatrice.** A `useSyncLocaleToStore` hook mirrors the active i18next language (normalized via `toBcp47`) into `server.locale` on mount and on every language change. The app's `<Suspense>` boundary moved from inside `AppShell` up to `index.tsx` — below `DatatriceProvider`/`WebClientProvider` but above all of `AppShell` — so a translation-load suspension (a non-bundled language fetching its namespace) resolves to that fallback without tearing down and reconstructing the `WebClient` singleton. Loading UX is unchanged.

  **ICU fallback.** When an ICU message fails to parse or format — e.g. a malformed Transifex translation such as a missing `select` comma or localized ICU keywords — the i18next-icu `parseErrorHandler` now re-renders it from the bundled, validated English source instead of emitting the raw `{…}` template to users. A failing English source (our own bug) is left visible rather than masked.

- f2ac3f1: The TopBar connection dot now has a third state: amber for "Server not responding (Ns)".

  Previously the dot was binary (green connected / red disconnected) and the transport killed quiet connections outright. With the transport now keeping silent connections open and reporting degraded health, the dot turns amber while pings go unanswered — with the silence duration in the accessible label — and recovers to green on the next pong. Players see honest degradation instead of a silent freeze followed by an unexplained bounce to login.

- f2ac3f1: Virtualized lobby lists: the games table and user panels render only the visible window, so busy servers no longer cost a full re-render of thousands of rows per update.

  **`VirtualRows`.** A render-prop variant of the existing `VirtualList` component — rows are built lazily for the visible window only (prebuilding `items: ReactNode[]` is itself O(N)), backed by react-window.

  **Games list.** The room's games table (previously a full `<table>` re-rendering every game per list-update frame — thousands of rows on a busy server) is now a fixed-grid header above a `VirtualRows` body sharing one grid template. Sorting, selection, double-click join, filters, and the empty state are unchanged.

  **User panels.** The server page's Players Online panel and the room page's Buddies + Players Online panels render through `VirtualRows` (28px rows) — a thousand-user server costs a viewport of rows per join/leave event instead of the full population.

  **Room chat.** Chat rows wrap to variable heights and every message must stay reachable in scrollback (deliberately not windowed), so the per-append cost is bounded by memoizing rows instead: existing messages skip re-render on append.

  **Code-review refinements.** Virtualized user rows are keyed by user name, so an open user context menu can no longer retarget to a different user when the roster reshuffles under it. Room-chat rows are keyed on a stable, ingestion-assigned message id that survives the 1000-message cap trim (the old array-index key broke exactly at steady state). The games table header and its virtualized body both reserve a stable scrollbar gutter, so columns stay aligned once the list overflows. `VirtualList` is expressed over `VirtualRows`, the two user panels share a `UserRows` component, and the games row renderer is memoized.

### Patch Changes

- f2ac3f1: Restore accessible table semantics to the games list and run the app e2e suite
  across Firefox and WebKit (Safari), not just Chromium.

  The move to the virtualized `VirtualRows` dropped the games list's native `<tr>`
  row semantics, leaving it as a flattened `role="list"` — assistive tech could no
  longer navigate it by row or column. `GamesList` now exposes proper grid roles
  (`role="table"`/`rowgroup`/`row`/`gridcell`/`columnheader`, with `aria-sort` and
  `aria-rowcount`). `VirtualRows` gained a single optional `role` override so a
  tabular consumer can make react-window's `<List>` a `rowgroup` (react-window
  hardcodes `role="list"`, an invalid parent for `role="row"`); roster and chat
  panels keep the `list` default.

  CI now fans the app e2e job out into a `chromium` / `firefox` / `webkit` browser
  matrix, each on its own runner and Servatrice stack. Validated locally green
  (6/6 specs) on all three engines.

- f2ac3f1: Add a refresh button to the known-hosts selector that re-runs the connection
  test for the currently selected host. It sits inline in the closed selector, to
  the left of the dropdown chevron, and spins while a probe is in flight. Probes
  otherwise only fire on host selection, so a host that was briefly unreachable
  (e.g. a local server just started) previously required re-selecting the host to
  re-test — this gives users a direct way to retry.

  This also removes the now-dead known-hosts recovery effect that re-probed
  whenever `testConnectionStatus` went `null`. That effect only existed to recover
  from a disconnect wiping the probe result; with the result now carried through
  the reset reducers, it produced redundant probes that counted against
  Servatrice's per-IP connection cap. Probes now fire solely on genuine user
  actions — host selection, pick, or the new refresh button.

- f2ac3f1: Fix toasts silently failing after a language change. `useToast` captured its
  `children` once at registration and `OPEN_TOAST` silently no-oped when the entry
  was absent, so switching the UI language (which suspends and re-registers the
  toast subtree) could leave host add/edit/delete showing no toast and no console
  warning. `openToast` now accepts fire-time content and upserts the entry
  (create-or-update, then open), so it can't silently drop; a new `updateToast`
  keeps registered content current when the language changes; and an unregistered
  no-arg open logs a DEV warning instead of vanishing. `KnownHosts` computes its
  toast text at fire time, which also fixes edit/delete toasts previously
  mislabeled as "created". Backward-compatible for existing no-arg `useToast`
  callers.
- f2ac3f1: Fix: adding a new host no longer auto-logs you in.

  Dialogs portal to `document.body`, but React dispatches synthetic `submit` events along the React component tree, not the DOM tree. Because the Add-Host dialog (`KnownHostForm`) renders inside the Login form's React subtree, clicking **Add Host** bubbled its submit up to the Login form's `onSubmit`, which — with a saved-password host selected and the password field empty — injected the stored `hashedPassword` and logged the user in.

  `DialogShell` now stops `submit` propagation at the portal root, containing every dialog form's submit at the modal boundary so it can never reach a form on the page behind it. Added a regression spec asserting an inner dialog-form submit does not fire an ancestor form's `onSubmit`.

- f2ac3f1: Fix i18n breakage caused by underscore locale codes reaching JS `Intl` APIs, and repair language switching.

  **ICU/`Intl` crash.** The active language could be a Cockatrice/Transifex-style underscore code (e.g. `pt_BR`, cached in `localStorage['i18nextLng']`), which is an invalid BCP-47 tag. `Intl.NumberFormat`/`Intl.PluralRules`/`Intl.Collator` reject it with `RangeError: Invalid language tag`, so every ICU format threw and i18next-icu silently returned the raw template — visibly, the account-age string rendered as `{years, plural, ...}` instead of `1 year, 1 day`. A new `toBcp47` helper normalizes underscore codes to hyphens only at the `Intl` boundaries: ICU's `parseLngForICU` and the `Intl.Collator` in `useLocaleSort`. The underscore form stays canonical everywhere else (the `Language` enum, `localStorage`, and the `public/locales/<code>` directories).

  **Language switching.** The `I18nBackend.read` loader guarded on `language[Language]`, which always evaluated to `undefined`, so it never fetched any non-English locale file — selecting a different language did nothing. `read` now fetches `public/locales/<code>/<namespace>.json` by the raw code, with a 404 (e.g. bundled `en-US`) resolving to an empty resource.

  **Diagnostics.** ICU's `parseErrorHandler` now logs format failures in dev instead of swallowing them silently.

- f2ac3f1: Show a distinct, cautiously-worded hint on the login screen when a connection
  attempt can't reach the server, instead of the same generic "Connection
  Closed"/"Connection Failed" text used for every disconnect. `useLogin` reads the
  `getConnectUnreachable` selector and, only while disconnected, substitutes
  _"Trouble reaching the server. Wait a minute and try again."_ for the generic
  status string (the wait matches how a per-IP rate-limit self-heals after a quiet
  window). It appears both when the login connect fails and when the known-hosts
  "refresh test connection" probe can't reach the host.

  Detection and display only — no reconnect/backoff change, login screen only, and
  the wording does not claim rate-limiting (a failed connect can equally be the
  user's own network).

- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
- Updated dependencies [f2ac3f1]
  - @cockatrice/datatrice@4.5.0
  - @cockatrice/sockatrice@4.3.0

## 5.2.0

### Minor Changes

- 0a0df44: Deck editor preloads card images with a skeleton loader, and Google Analytics is wired in to track daily usage and deck format distribution.

  **Deck editor image preload + skeleton.** Opening a deck (especially the first time, or after a hard refresh) previously left hover-preview feeling laggy: card JSON was cached fast by the Dexie Scryfall layer but the actual image bytes only fetched on the first `<img>` mount, adding ~200–500ms of blank-then-pop per card. The editor now preloads every card's `normal`-sized preview URL up-front via `new Image()` so the browser HTTP cache is warm before the sidebar preview ever renders. During hydration + preload it shows a proper skeleton (mirrors the real 360px sidebar + main grid, `animate-pulse` placeholders, a `Preloading N/M cards…` progress line) instead of the old spinner. The gate uses a `readyDeckId` value guard so subsequent add / remove / printing-swap doesn't re-block the UI — only navigating to a different deck resets it. Image `onerror` counts as done so a single 404 can't stall the deck.

  **Google Analytics.** GA4 gives daily active users, session counts, and pageview totals out of the box. The measurement id is supplied per-environment at deploy time (not hard-coded): `deploy.yml` writes it into a runtime config file (`public/env.js` → `window.Cockatrice.env.RR_GA_KEY`) from the `RR_GA_KEY` environment variable, and `src/services/analytics.ts` `initAnalytics()` bootstraps the gtag tag only when a valid `G-…` id is present. The key is optional — environments without `RR_GA_KEY` simply run with analytics disabled, no broken requests. A typed `trackEvent()` helper wraps `window.gtag` and safely no-ops when the tag isn't present (dev, offline, ad blockers). Two custom events fire on top of the automatic pageviews:

  - `deck_opened { format }` — fires when the deck editor finishes hydrating a deck. Uses the normalized `HydratedDeck.format` (defaults to `commander` for legacy files without a `<format>` tag) so bucket labels match the editor UI.
  - `game_deck_submitted { format }` — fires when a player submits a deck to a game via the deck-select dialog. Lightweight regex against the `.cod` XML pulls the `<format>` value; legacy files without one report `unknown` so those still surface as a bucket instead of being dropped.

## 5.1.0

### Minor Changes

- a5476e9: Card preview polish: pop-out window, image/text/both view toggle, related-card navigation with back stack, resizable sidebar, phase-tracker auto-hide toggle, and full i18n coverage for shortcut labels.

  **Pop-out preview.** A new "Pop out" button in the sidebar's Preview header spawns a small browser window (`/card-preview-popup`) that mirrors the currently hovered card via `BroadcastChannel` — Cockatrice-parity for moving the preview to a second monitor. The popup does not do its own Scryfall fetch; the main window ships the fetched detail on the channel so both surfaces render the same content without racing. A heartbeat/watchdog pair distinguishes "quiet" from "disconnected" so the popup flips to a dimmed "Reconnecting…" state (without closing) when the main window refreshes, and pulls back once broadcasts resume.

  **Image / Text / Both view.** The Preview header gains an icon-only segmented control matching Cockatrice's three view modes. Selection persists globally in `localStorage`. In "both" mode the sidebar stacks image over text; the popup uses explicit `vh`-based slots so a long oracle can never push the image off-screen.

  **Related-card navigation with back stack.** `CardRelatedLinks` now renders inside the popup as well, and clicking a link swaps the preview to that card. The sidebar's related-link override is now a stack so chains (card → token → combo piece) can be walked; a `← Back to {previous card}` button appears at the top of the text pane in both surfaces and pops one entry at a time. Hovering a different card in the main window resets the stack. Popup navigation posts back to the main window so both surfaces stay in sync (no independent popup state to drift).

  **Resizable sidebar.** A new `SidebarResizer` drag handle resizes the right rail; width persists across sessions via `useSidebarWidth` and drives the game grid's `--sidebar-width` column.

  **Phase tracker auto-hide toggle.** The phase tracker's auto-hide behaviour is now user-controllable via a new toggle (default: pinned).

  **Fallback card art sizing.** The "Hover a card" placeholder in the popup now uses the same `aspect-[5/7]` sizing rules as `CardImage` — filling the "both"-mode height slot or the full pane width in single-pane — instead of being capped at a fixed 320px.

  **Shortcut labels.** `ShortcutsTab.i18n.json` now covers all 71 default action IDs (was 14). Missing labels were rendering the raw `ShortcutsTab.action.game.*` key in the settings tab.

## 5.0.0

### Major Changes

- 4396583: Ground-up UI revamp ("sonic"): a new visual system, a rewritten game board and navigation, plus a full deck editor, private chats, in-game context menus, and a greatly expanded shortcut system.

  **New styling engine and theme.** MUI's `ThemeProvider` / `CssBaseline` and `material-theme.ts` are gone; Tailwind CSS 3.4 (+ PostCSS/autoprefixer) provides the styling layer, with a dark purple design-token palette (`styles/tokens.css` mapped to Tailwind utilities) and `lucide-react` iconography. The MUI components still in use are reskinned via `styles/mui-overrides.css`; `InputField`, `CheckboxField`, and `Toast` are now custom Tailwind components. The app is dark-only.

  **Tabbed top navigation.** A new browser-style `TopBar` derives tabs from route + store state: a pinned Lobby tab plus tabs for joined rooms, active games, the open deck, shortcuts, and player chats. Closing a room/game tab sends the leave command; deck/shortcut/player tabs are sticky so open work survives navigation. An F5 refresh restores the last route via localStorage (MemoryRouter has no URL bar).

  **Game board rewrite.** The right-sidebar architecture (`RightPanel`, `CardPreview`, `GameLog`, `PhaseBar`, `TurnControls`) is deleted, replaced by the `PlayerBox` component tree with a `BattlefieldSidebar` right rail (hovered-card preview, player list, chat), a `PhaseTrack`, a rewritten arrow overlay, and a new pre-game `GameLobby` (deck picking from `.cod`, ready/host controls, spectators). The chat log renders datatrice's new segmented log entries with per-token styling and tone-based coloring. New in-game affordances: drag **drop hints** (the target snap cell highlights during a drag, scoped to the board you're over), an optional **snap-grid** overlay toggle, battlefield card **transform/flip-face** support, `ZoneRevealDialog` / `IncomingRevealDialog` / `LibrarySearchDialog`, and a middle-click big-card zoom.

  **In-game context menus.** A portal-based `ContextMenu` (dividers, checkable items, shortcut hints, nested submenus) is wired across cards, the battlefield/library/graveyard/hand/exile zones, player seats, and the player list — card actions, move-to-zone, counters, P/T, flip, clone, peek, attach, and moderation/seat actions.

  **Full deck editor.** `features/decks` is net-new (the previous page was a stub): a card-search editor backed by Scryfall (read-through Dexie cache, new `scryfallCache` table in DB v4), `.cod` XML parse/serialize with autosave to servatrice, mana-curve/type/color breakdowns, printings, pricing with TCGplayer buy links, Commander bracket assessment, import from decklist text, and an export modal. Decks are cached in-memory across tab switches; the My Decks card/list view mode persists to localStorage. The deck route is now `/deck/:deckId` (was `/deck`).

  **Related cards.** `CardRelatedLinks` shows a card's other faces, tokens, meld pieces, and combo pieces (from Scryfall `card_faces`/`all_parts`) in the right-rail preview, the big-card zoom, and the deck editor's card detail modal — with add-to-deck affordances where applicable.

  **Private chats.** The player profile page is now a two-column layout with a private-chat panel driven by `Command_Message` / `Event_UserMessage`. Chats open from a right-click `UserActionsMenu` on any username (chat messages, player lists); open conversations persist as sticky TopBar tabs, and a global `PrivateMessageNotifier` pops a toast for new inbound messages (suppressed while viewing that sender).

  **Keyboard shortcuts.** Default game shortcuts grow from 16 to 71 actions, mirroring Cockatrice desktop where browser-safe (untap-all is `Ctrl+U`, not F5; other Chromium-reserved keys rebound). Coverage spans phases/turn, draw/mulligan, zone views, P/T deltas, card counters, selection, clone/flip/peek/attach, arrows, tokens, and deck-editor/room bindings. A new `/shortcuts` page (from the account menu) shows visual keycaps.

  **Fixes** from play-testing: battlefield drag/move correctness backed by datatrice's new optimistic-move handling (no flicker/revert), big-card preview rework, `.cod`/decklist parser hardening (cards without UUIDs still resolve and price), Chrome autofill styling, and reveal/search dialog behavior.

  **Breaking changes:** the deck editor route moved to `/deck/:deckId`; the light MUI theme is gone (dark purple only); the in-game right-sidebar layout is replaced wholesale; several shortcuts differ from Cockatrice desktop; the deck editor calls Scryfall and links to TCGplayer.

### Patch Changes

- Updated dependencies [4396583]
- Updated dependencies [4396583]
  - @cockatrice/datatrice@4.4.0
  - @cockatrice/sockatrice@4.2.0

## 4.1.8

### Patch Changes

- 1aa18d0: Extend the bulk card-action surface to drag-moves, P/T, annotation, and counters.

  `request.game.*` gains four more multi-card commands (one file each, in
  `commands/game/bulk/`): `bulkSetPT`, `bulkSetAnnotation`, `bulkIncCardCounter`, and
  `bulkSetCardCounter`. Each batches one per-card command into a single
  `CommandContainer` and judge-wraps per owner, matching the existing bulk commands.

  webatrice now routes these through the selection instead of acting on one card:

  - **Drag-and-drop** — every drop kind (battlefield reposition, hand/stack/popup
    reorder, and cross-zone) moves the whole selection via `bulkMove`. The dragged
    card alone is the unchanged single-card case.
  - **Set P/T** and **Set annotation** (card menu) apply the entered value to every
    selected card.
  - **Counters** — the inline +/- delta and the "Set counter" prompt apply across the
    selection.

  A multi-selection only takes effect when the acted-on card is part of it; otherwise
  each action behaves exactly as before on the single card.

- fd8aea4: Make the card drag preview match the resting card.

  While dragging, the floating preview rendered only the card image and ignored
  tapped state. It now reuses the resting slot's presentation: `CardSlotContent` is
  extracted from `CardSlot` and shared with `CardDragOverlay`, so the preview shows
  the same name, P/T, owner/annotation pill, and counters, and stays rotated 90°
  when the dragged card is tapped.

- 1aa18d0: Consume the bulk card-command surface from sockatrice instead of local dispatchers.

  The local `bulkCardActions.ts` and `moveTarget.ts` utils are removed; the card context
  menu and double-click tap now call `webClient.request.game.bulkTap` / `bulkFlip` /
  `bulkDoesntUntap` / `bulkPeek` / `bulkMove`, and `moveTargetPlayerId` is imported from
  `@cockatrice/sockatrice` (used by drag-and-drop and the move-to-library dialog).
  `SelectedCard` aliases sockatrice's `CardLocation`. Zone-name references now import
  `ZoneName` from `@cockatrice/sockatrice`. No user-facing behavior change — single and
  multi-card Tap / Doesn't Untap / Flip / Peek / Move still produce one atomic command
  per gesture, judge-wrapped for foreign owners.

- Updated dependencies [1aa18d0]
  - @cockatrice/datatrice@4.3.0

## 4.1.7

### Patch Changes

- 698d8c4: Animate battlefield cards with the Card Preview's 3D flip when they are turned face-up/face-down.

  The `rotateY` flip (with its mid-flip scale dip) previously lived only in the right-sidebar Card
  Preview. It is now extracted into a shared `src/styles/card-flip.css` (neutral `cardflip` classes:
  resting `--front`/`--back` plus one-shot `--animate-to-front`/`--animate-to-back` keyframes), imported
  once via `index.css`. Both `CardPreview` and `CardSlot` consume it.

  `CardSlot` now renders both faces (image front + face-down back) inside a `perspective` frame so the
  flip reveals the other side. A small guard in `useCardSlot` adds the animate class only after
  `card.faceDown` actually changes, so the keyframe plays on real flips (both directions) without every
  slot spinning on initial board render. Honors `prefers-reduced-motion`.

- b2a9b58: Reveal face-down cards through the flip command so they render after resuming a game.

  The card context menu's "Face Up/Face Down" toggle sent setCardAttr(AttrFaceDown), whose
  Event_SetCardAttr carries no card identity. After resuming an in-progress game the client has no
  local identity for a face-down card (the server sends face-down cards with an empty name, and the
  provider id is usually empty), so turning it face up that way left it with nothing to render and
  the image was blank. The toggle now uses Command_FlipCard, whose event reveals the card's
  name/providerId when it turns face up. The redundant separate "Flip" menu item (which already used
  the flip command) is removed, leaving the clearer "Face Up/Face Down" label as the single
  face-down toggle.

## 4.1.6

### Patch Changes

- e0a1d55: Refactor the game feature out of deep prop-drilling and into hook/context layers (no behavior change).

  `Game` previously threaded `gameId`, the hovered-card preview, local identity, and the entire
  dialog/menu state slice (~80 props across ~10 dialogs/menus) down through the tree. These are now
  sourced from focused contexts and hooks:

  - `GameIdContext` (`useGameId` / `useGameIdRequired`) provides the active game id once; ~18
    board/sidebar components and the dialogs read it from context instead of a prop.
  - `useLocalIdentity` consolidates `localPlayerId`/`isHost`/`isJudge`/`isSpectator`.
  - `CardPreviewContext` lifts the hovered-card preview so `RightPanel` no longer forwards it.
  - `GameDialogsContext` carries the dialog/menu state machine; the context menus and dialogs
    (roll-die, create-token, sideboard, reveal, game-info, deck-select, player menu) self-source and
    self-gate, rendering propless. Each dialog folds its own derived data (e.g. the sideboard's
    deck/sideboard cards, the reveal target list) in its own hook/selector.
  - `BoardCellContext` provides per-seat `{ playerId, mirrored, isLocal }` so `PlayerBoard`,
    `Battlefield`, `StackColumn`, `PlayerInfoPanel`, and `ZoneStack` stop forwarding seat identity.

  Re-render hygiene: the `useGameDialogs` return is memoized and the propless dialog/menu consumers
  are wrapped in `React.memo`, so they no longer re-render on every `Game` render (e.g. arrow-drag
  ticks). Shared helpers were extracted to remove duplication (`activePlayersOf`), and the
  context-menu hooks now treat an absent `gameId` as `undefined` rather than a `0` sentinel.

  Positional props (`playerId`, `zoneName`, a menu's target card/anchor, a popup's initial position)
  and the generic `@app/dialogs` (`PromptDialog`, concede `ConfirmDialog`s) are intentionally left as
  props.

- e0a1d55: Make the game dialog/menu memoization pay off during play, restore reveal seat order, and clean up
  context boilerplate (no behavior change).

  - Reveal-target dropdown and board layout now seat from datatrice's `seatedPlayersOf` /
    `getSeatedPlayers`, restoring server seat/join order (it had regressed to numeric-key order).
    `utils/activePlayers.ts` is removed in favor of the shared datatrice helper.
  - `useGameDialogs` action handlers no longer close over the whole `game`/`localPlayer`; they read
    the latest values from the store at call time. The hook now returns a stable `actions` object
    merged with the dialog state, so the propless `React.memo`'d dialogs and context menus stop
    re-rendering on every `Game` render (e.g. card moves, arrow-drag ticks) and only update when
    dialog state changes. The `GameDialogs` type is split into `GameDialogsState` &
    `GameDialogsActions` so the shape, the hook return, and the test no-op default stop being
    hand-synced.
  - A `createRequiredContext` factory replaces the duplicated throw-if-absent boilerplate in
    `BoardCellContext`, `GameDialogsContext`, `GameDialogActionsContext`, and `GameInteractionContext`.
    A shared `playerName(player)` helper unifies the `userInfo?.name ?? \`p${id}\``fallback used by
the reveal list, turn controls, and the game-info dialog.`GameInfoDialog`and`CardContextMenu`reuse`useCurrentGame`, and the dead `DeckSelectDialog` close prop is removed.

- 7e02622: Harden the game store against the Immer / protobuf-es hazard and optimize game-board rendering.

  - **Store (datatrice):** reducers across the games/rooms/server slices now clone-and-reassign protobuf-es messages instead of mutating them in place. Immer can't draft proto2 messages, so in-place writes (`counterSet`, `adjustMod`, `replayModifyMatch`, `playerPropertiesUpdated`, and the room/game list merges) went untracked, and several spreads dropped unset proto2 fields. Adds a `cloneWith` helper and a `dequal` dependency.
  - **Attachment selector:** `getAttachmentsByParent` returns a stable reference when the attachment graph is unchanged (reselect `lruMemoize` + `dequal`), so a single card mutation no longer rebuilds-and-re-renders the whole battlefield.
  - **Render (webatrice):** battlefield row/column card arrays are reference-stabilized, and `Battlefield`/`HandZone`/`PlayerList`/`PlayerInfoPanel` are memoized, so tapping one creature re-renders only that card's subtree instead of the entire board and sidebar.

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
