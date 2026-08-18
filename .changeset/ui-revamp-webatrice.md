---
"@cockatrice/webatrice": major
---

Ground-up UI revamp ("sonic"): a new visual system, a rewritten game board and navigation, plus a full deck editor, private chats, in-game context menus, and a greatly expanded shortcut system.

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
