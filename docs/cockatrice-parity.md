# Cockatrice parity

Where Webatrice stands against the desktop client, and how the parity PR series gets it there. Desktop Cockatrice at
master `add65ca` is the spec.

The rows come from a functional-parity audit of Webatrice `cfdf276` against Cockatrice `a571a9a` (2026-08-24): 94
stable IDs in three areas. `PLAT` covers platform, connection, account, rooms, chat and users; `GAME` covers decks,
the game lobby and live play; `LONG` covers replays, settings, accessibility, moderation, card data and desktop
tooling. Statuses:

- **Complete**: the capability is available. It need not be pixel- or interaction-identical.
- **Partial**: a usable or lower-layer implementation exists, but important behaviour is missing.
- **Missing**: no implementation.
- **Out of scope**: not a parity target for a browser client; see [Out of scope](#out-of-scope-for-a-browser-client).

Priority is the audit's impact rating: P1 is a major normal workflow, P2 secondary, P3 specialised or low impact.
No P0 blocker was found.

## Summary

| | Complete | Partial | Missing | Divergent | Unverified | Out of scope |
|---|---|---|---|---|---|---|
| Audit (2026-08-24) | 29 | 35 | 22 | 6 | 2 | — |
| After the series | 85 | 5 | 0 | 0 | 0 | 4 |

62 rows changed status from the audit. All 94 IDs are accounted for. Every P1 row is Complete except LONG-017;
LONG-005 is out of scope.

### Still open

These are the five Partial matrix rows. Owners below identify the delivered work; no final PR is assigned to
close their remaining gaps. Specific follow-ups on rows a PR explicitly closes are recorded in the matrix notes
and the 3.1 feature table, and do not count as additional open matrix rows.

| Rows | What remains | Owner |
|---|---|---|
| GAME-006 | Edit banner/tags from storage; author per-deck playmats | `parity/18-decks` delivered editor metadata; remaining work unassigned |
| GAME-023 | Move cards out of custom-zone views; dump hidden custom zones | `parity/17b-game-menus` delivered menus/views; remaining work unassigned |
| LONG-010 | Styled user rows, quick-filter toolbar, visual deck workflows, persistent menus and zone-view double-click play | `parity/19-settings`, `parity/25a-platform-prefs`, `parity/25b-board-prefs`; remaining work unassigned |
| LONG-016 | Locale-completeness threshold; remaining non-JSX English (including replay parse errors); checker coverage of .ts hooks and dynamic keys | `parity/28-i18n-gate`, `parity/31-deck-i18n-a11y`, `parity/32-game-i18n`; remaining work unassigned |
| LONG-017 | Route-change focus, NewSetsPrompt focus and shared dialog restoration; toast announcements under modals | `parity/26-a11y-primitives`, `parity/27-a11y-keyboard-paths`, `parity/29-game-a11y-1`, `parity/30-game-a11y-2`, `parity/31-deck-i18n-a11y`; toast fix deferred to UI rework, rest unassigned |

PR 19 and PR 25b disagree on persistent/tear-off menus: 19 and the backlog call them browser-possible follow-ups;
25b calls them N/A. They remain open under interface preferences. PR 25b also lists desktop's tally type as a
follow-up although PR 17b closes the tally action. That wording conflict remains noted under appearance;
the tally row follows 17b's explicit closure. PR 22's original status summary predates the final series and is
superseded here, including its Complete claim for deck metadata, which PR 18 explicitly keeps Partial.

## Matrix

"Closed by" names the branch that did the work. "Audit baseline" means the row was already Complete at the audit.
Statuses follow the final PRs' closure claims and qualifications; a closed row can still have a listed follow-up.
The audit status never changes. The shortcut-catalogue claim in 17c closes LONG-009; the separate accessibility
IDs P*, G* and D* in 26–31 are progress on LONG-017, not claims to close that whole row.

### Platform, connection, account, server, room, chat and users

| ID | Capability | Priority | Status | Closed by / owner | Note |
|---|---|---|---|---|---|
| PLAT-001 | Protocol: protocol framing/version/features | P3 | Complete | audit baseline |  |
| PLAT-002 | Protocol: current protocol source synchronization | P1 | Complete (was Partial) | `parity/03-protocol` | Protocol synchronized to Cockatrice `add65ca`, with every new command builder (03 Summary); playmat/RTT state and UI followed in `parity/23-playmats`. |
| PLAT-003 | Protocol: client version identity | P2 | Complete (was Divergent) | `parity/03-protocol` | `clientver` is `webatrice-<version> (<commit date>)`, like desktop `VERSION_STRING`. |
| PLAT-004 | Protocol: command response lifecycle | P2 | Complete (was Partial) | `parity/04-command-outcomes` | Per-command deadline; timeouts and disconnects settle once with `RespNotConnected`. |
| PLAT-005 | Transport: browser WebSocket and keepalive | P3 | Complete | audit baseline | e2e covers Chromium, Firefox and WebKit since `parity/06-e2e-hardening`. |
| PLAT-006 | Transport: unexpected-drop recovery | P1 | Complete (was Partial) | by decision | Explicit re-login, as desktop. See [Out of scope](#out-of-scope-for-a-browser-client). |
| PLAT-007 | Transport: close-reason handling and state teardown | P3 | Complete | audit baseline |  |
| PLAT-008 | Server events: shutdown and directed server notices | P1 | Complete (was Partial) | `parity/04-command-outcomes`, `parity/14-reports` | Shutdown and directed notices (04); report notices (14). |
| PLAT-009 | Persistence: known hosts, remembered verifier, and auto-login | P3 | Complete | audit baseline |  |
| PLAT-010 | Connection UI: public server discovery | P2 | Complete (was Partial) | `parity/10-account-auth` | Public server list with cached fallback. |
| PLAT-011 | Auth: login, registration, and password recovery | P3 | Complete | audit baseline |  |
| PLAT-012 | Auth: activation-to-login credential continuity | P1 | Complete (was Partial) | `parity/10-account-auth` |  |
| PLAT-013 | Auth: actionable login errors | P2 | Complete (was Partial) | `parity/03-protocol` | Server full and password change required are mapped. |
| PLAT-014 | Account: self-service profile/password/avatar editing | P1 | Complete (was Partial) | `parity/10-account-auth` | Same work as LONG-019. |
| PLAT-015 | Navigation: reachable platform routes | P1 | Complete (was Partial) | `parity/10-account-auth` | User menu from `userMenuEntries.ts`; dead LeftNav removed. |
| PLAT-016 | Lobby: room lobby and safe MOTD | P3 | Complete | audit baseline |  |
| PLAT-017 | Room: room permission display | P2 | Complete (was Partial) | `parity/11-rooms-chat-users` |  |
| PLAT-018 | Room: room-join failure feedback | P1 | Complete (was Partial) | `parity/11-rooms-chat-users` | Includes desktop's leave-and-rejoin on `RespContextError`. |
| PLAT-019 | Room: autojoin and room-tab lifecycle | P3 | Complete | audit baseline |  |
| PLAT-020 | Room users: online/buddy/ignore side panel | P3 | Complete | audit baseline |  |
| PLAT-021 | Room chat: ignored-user, flood, and history semantics | P1 | Complete (was Partial) | `parity/11-rooms-chat-users` |  |
| PLAT-022 | Private chat: delivery status and draft recovery | P1 | Complete (was Partial) | `parity/11-rooms-chat-users` | PR 11 claims closure with a follow-up: empty open private chats lack presence notices. |
| PLAT-023 | Notifications: private-message background notification | P2 | Complete (was Partial) | `parity/19-settings` | Browser notifications after explicit permission; toast fallback. |
| PLAT-024 | Users: profile, buddy, and ignore core actions | P3 | Complete | audit baseline |  |
| PLAT-025 | Users: show games of user | P2 | Complete (was Missing) | `parity/11-rooms-chat-users` | Same work as LONG-022. PR 11 leaves full-game spectator confirmation and response-provided room names as follow-ups. |
| PLAT-026 | Browser support: declared browser compatibility | P1 | Complete (was Unverified) | `parity/24-platform-gates` | Declared support, pre-bundle API preflight and unsupported-browser screen. Backlog: minimum-version coverage and saved theme on that screen. |
| PLAT-027 | Reliability: fatal UI error containment | P1 | Complete (was Missing) | `parity/04-command-outcomes` | Route and game error boundaries. |
| PLAT-028 | Quality gates: platform regression gate | P1 | Complete (was Partial) | `parity/01-lint`, `parity/06-e2e-hardening`, `parity/24-platform-gates` | e2e typecheck and forced-drop/re-login gate delivered; `parity/t1-test-memory` corrects the drop assertion. Browser flakes remain in the backlog. |

### Decks, game lifecycle and live gameplay

| ID | Capability | Priority | Status | Closed by / owner | Note |
|---|---|---|---|---|---|
| GAME-001 | Deck storage: Server deck CRUD and persistence | P3 | Complete | audit baseline |  |
| GAME-002 | Deck storage: Remote folder hierarchy | P3 | Complete (was Partial) | `parity/18-decks` |  |
| GAME-003 | Deck editor: Core edit/search/printing/commander/bracket workflow | P3 | Complete | audit baseline | `parity/35-scryfall-search-errors` reports failed searches instead of empty results and ignores superseded outcomes. This Webatrice-specific fix closes no desktop parity row; Scryfall scheduling/rate limiting remain backlog. |
| GAME-004 | Deck validation: Card format legality and allowed quantity | P2 | Complete (was Missing) | `parity/18-decks` |  |
| GAME-005 | Deck safety: Undo/redo and edit history | P2 | Complete (was Missing) | `parity/18-decks` |  |
| GAME-006 | Deck metadata: Banner card and tags | P3 | Partial | `parity/18-decks`; remaining work unassigned | Banner, tags and playmat round-trip; banner/tags editable in the editor. Storage-view editing remains open; per-deck playmat authoring is also backlog. |
| GAME-007 | Deck tools: Sample hand | P3 | Complete (was Missing) | `parity/18-decks` |  |
| GAME-008 | Deck interchange: Text/clipboard/file import and export | P3 | Complete | audit baseline |  |
| GAME-009 | Deck integrations: Online load/export/analyze/print helpers | P3 | Complete (was Partial) | `parity/18-decks` |  |
| GAME-010 | Game creation: Protocol-relevant game options | P3 | Complete | audit baseline |  |
| GAME-011 | Join/spectate: Player, spectator and judge join with passwords/errors | P3 | Complete | audit baseline |  |
| GAME-012 | Lobby: Deck select, ready, chat, host kick and leave | P3 | Complete | audit baseline |  |
| GAME-013 | Lobby: Force start | P1 | Complete (was Divergent) | `parity/16-game-lobby` | One `ReadyStart {ready, force_start}`, as desktop. |
| GAME-014 | Between games: Sideboard plan and lock before ready | P2 | Complete (was Partial) | `parity/16-game-lobby` |  |
| GAME-015 | Lifecycle/roles: Host change/kick, judge override, spectator gating, concede/unconcede, leave/close | P3 | Complete | audit baseline |  |
| GAME-016 | Battlefield: Movement, DnD, stack and selection/bulk actions | P3 | Complete | audit baseline | Hand reorder fixed in `parity/02-hand-reorder`. |
| GAME-017 | Card state: Tap, face/peek/flip, P/T, annotation, clone/related, counters | P3 | Complete | audit baseline |  |
| GAME-018 | Zone-view selection: Select all/column in grave/exile view | P3 | Complete (was Partial) | `parity/05-refactor-seat` | Stage 4 closes Select All / Select Column in graveyard and exile views. |
| GAME-019 | Hand: View/sort/reveal/random reveal/mulligan/move-all/play | P3 | Complete | `parity/33-hand-sort-local` | Complete at audit; 33 closes the remaining sort gap with a local zone reorder and desktop sort keys, sending no game commands. Hand drag reorder was fixed in `parity/02-hand-reorder`. |
| GAME-020 | Library: Draw/undo/search/reveal/lend/top-bottom/move-until/partial shuffle | P3 | Complete | audit baseline | Move-to-position still displays zero-based positions; desktop displays one-based positions (32/backlog). |
| GAME-021 | Library: Open current game deck in editor | P3 | Complete (was Partial) | `parity/17b-game-menus` | Opens the actual game deck as an unsaved draft, including file/clipboard decks; no stored-deck name or hash lookup. |
| GAME-022 | Other standard zones: Graveyard, exile, live sideboard and stack actions | P3 | Complete | audit baseline; `parity/36-stack-play-x` follow-up | Every stack play sends x = -1, including hand-card "Draw arrow..." auto-play fixed in 36. Stack-to-graveyard moves retain x = 0. |
| GAME-023 | Custom zones: View and act on arbitrary server-defined zones | P2 | Partial (was Missing) | `parity/17b-game-menus`; remaining work unassigned | Custom-zone menu and view delivered. Moving cards out and dumping hidden custom zones remain open. |
| GAME-024 | Counters/chance: Player/card counters, dice, coin, increment-all | P3 | Complete | audit baseline |  |
| GAME-025 | Tokens: Custom/repeat/predefined/related/clone tokens | P3 | Complete | audit baseline |  |
| GAME-026 | Arrows/attachments: Create/delete/clear arrows and attach/unattach cards | P3 | Complete | audit baseline | Backlog: a departing player can leave other players' attachments pointing at deleted cards (r6). |
| GAME-027 | Battlefield summary: Subtype tally and total power | P3 | Complete (was Missing) | `parity/17b-game-menus` | Selection-wide subtypes, total power, total toughness and count. |
| GAME-028 | Turns/phases: Direct phase, next/previous, pass turn, phase action | P3 | Complete (was Partial) | `parity/17a-game-actions` | Next phase with action delivered. |
| GAME-029 | Turns: Reverse turn order | P2 | Complete (was Missing) | `parity/17a-game-actions` | Reverse-turn menu action and shortcut delivered. |
| GAME-030 | Board view: Manual player-view rotation | P3 | Complete (was Missing) | `parity/17a-game-actions` | Clockwise/counterclockwise view rotation delivered. |
| GAME-031 | Shortcuts: Core gameplay shortcut coverage and customization | P3 | Complete | audit baseline | Catalogue expanded in `parity/17c-shortcuts`; deck shortcuts and reserved New Deck binding fixed in `parity/31-deck-i18n-a11y`. |
| GAME-032 | Live log/chat: Gameplay event log and game chat | P3 | Complete | audit baseline | Structured entries and lobby split in `parity/r3-log-lobby`. Sidebar overflow at 720p and card-link colour are deferred to the UI rework. |
| GAME-033 | Invitations: Invite a specific user from the live game | P3 | Complete (was Partial) | `parity/16-game-lobby` | Invite and copy `cockatrice://joingame` link; links in chat join. |

### Replay, settings, accessibility, moderation and desktop/browser tooling

| ID | Capability | Priority | Status | Closed by / owner | Note |
|---|---|---|---|---|---|
| LONG-001 | Replay: Server replay catalog | P1 | Complete (was Partial) | `parity/15-replays` |  |
| LONG-002 | Replay: Replay playback and timeline | P1 | Complete (was Missing) | `parity/15-replays`; `parity/34-replay-reveals` follow-up | Replay reveals open read-only during playback, sending no card commands. Rewinds suppress all reveal windows; forward seeks suppress events more than 10 seconds before the target. General replay zone viewing remains backlog. |
| LONG-003 | Replay: Local replay files and library | P2 | Complete (was Missing) | `parity/15-replays` | Library in IndexedDB; `.cor` via file picker. |
| LONG-004 | Replay: Download, deletion, retention lock, and share codes | P2 | Complete (was Partial) | `parity/15-replays` |  |
| LONG-005 | Local play: Local/offline game | P1 | Out of scope (was Missing) | — | See [Out of scope](#out-of-scope-for-a-browser-client). |
| LONG-006 | Logs: Moderator log-history search | P3 | Complete (was Partial) | `parity/12-moderation-users` |  |
| LONG-007 | Diagnostics: Client debug-log viewer | P3 | Complete (was Missing) | `parity/21-appearance-i18n-diag` | Bounded, redacted, in memory; copy and clear. |
| LONG-008 | Settings: General preference surface and persistence | P2 | Complete (was Missing) | `parity/19-settings` | Startup destination and missing-feature notice added in `parity/25a-platform-prefs`; startup tips remain browser-possible backlog. |
| LONG-009 | Settings: Keyboard shortcut editor | P1 | Complete (was Partial) | `parity/17c-shortcuts` | Closes the shortcut-catalogue gap: 75 additional bindable game actions, grouped editor and handlers. Linux Ctrl+Q / Say-macro remaps remain follow-ups. |
| LONG-010 | Settings: Interface and gameplay preferences | P2 | Partial (was Missing) | `parity/19-settings`, `parity/25a-platform-prefs`, `parity/25b-board-prefs`; remaining work unassigned | Platform and board preferences delivered. Still open: styled user rows, quick-filter toolbar, visual deck workflows and persistent menus; zone-view double-click play also remains a 25b follow-up. |
| LONG-011 | Settings: Chat preferences, alerts, and macros | P2 | Complete (was Missing) | `parity/19-settings`, `parity/25a-platform-prefs` | Mention completion delivered in room/game chat (25a); Say menu and macros delivered in `parity/17b-game-menus`. |
| LONG-012 | Appearance: Themes, palette, and table presentation | P2 | Complete (was Divergent) | `parity/21-appearance-i18n-diag`, `parity/23-playmats`, `parity/25b-board-prefs` | 25b explicitly closes appearance: palettes, playmats, card presentation and zone backgrounds. Follow-ups: personal art overrides, per-player backgrounds and per-deck playmat authoring; 25b's tally-type follow-up conflicts with 17b's closure. |
| LONG-013 | Sound: Sound themes, enable/mute, volume, and test | P2 | Complete (was Missing) | `parity/19-settings` | Default/Legacy themes, mute, volume and test delivered; importing user sound themes remains browser-possible backlog. |
| LONG-014 | Notifications: Configurable desktop and in-app notifications | P2 | Complete (was Partial) | `parity/19-settings` |  |
| LONG-015 | Storage: Cache, file-path, and storage controls | P3 | Complete (was Divergent) | `parity/21-appearance-i18n-diag` | Storage usage and clears; desktop paths N/A (see Out of scope). |
| LONG-016 | Localization: Localized UI and language selection | P2 | Partial | `parity/21-appearance-i18n-diag`, `parity/28-i18n-gate`, `parity/31-deck-i18n-a11y`, `parity/32-game-i18n`; remaining work unassigned | Platform, deck and game extraction and missing-key CI delivered. Still open: locale-completeness threshold, remaining non-JSX strings and checker blind spots; replay parse errors remain English. |
| LONG-017 | Accessibility: Keyboard, focus, semantics, and assistive technology | P1 | Partial | `parity/26-a11y-primitives`, `parity/27-a11y-keyboard-paths`, `parity/29-game-a11y-1`, `parity/30-game-a11y-2`, `parity/31-deck-i18n-a11y`; remaining work unassigned | Platform/game/deck audit batches delivered, not an overall closure claim. Remains: route-change focus, NewSetsPrompt focus and shared dialog restoration; toast announcements under modals are deferred to the UI rework. |
| LONG-018 | Account: Registration, activation, and password recovery | P1 | Complete | audit baseline |  |
| LONG-019 | Account: Edit profile, password, and avatar | P1 | Complete (was Partial) | `parity/10-account-auth` | Same work as PLAT-014; raw user level/account age display remains backlog. |
| LONG-020 | Users: Buddy and ignore management | P1 | Complete | audit baseline |  |
| LONG-021 | Users: User details and private chat | P1 | Complete | audit baseline |  |
| LONG-022 | Users: Show a user's current games | P2 | Complete (was Missing) | `parity/11-rooms-chat-users` | Same work as PLAT-025; PR 11 claims closure with spectator-confirmation and room-name follow-ups. |
| LONG-023 | Safety: Report a user and track own reports | P1 | Complete (was Missing) | `parity/14-reports` | Needs a 3.1 server. PR 14 claims closure; private-chat reports still lack conversation evidence. |
| LONG-024 | Moderation: Warn, ban, histories, notes, roles, and kick | P3 | Complete (was Partial) | `parity/12-moderation-users` |  |
| LONG-025 | Moderation: Report review and case management | P3 | Complete (was Missing) | `parity/14-reports` | Needs a 3.1 server. |
| LONG-026 | Moderation: User investigation and remediation | P3 | Complete (was Missing) | `parity/13-administration` | Needs a 3.1 server. |
| LONG-027 | Administration: Server message, shutdown, config reload, lock, activation, and replay access | P3 | Complete (was Partial) | `parity/13-administration` |  |
| LONG-028 | Card data: Manual Oracle/card-data import | P2 | Complete (was Partial) | `parity/20-card-data` | Transactional v4 XML import delivered; desktop v3 card-database XML remains unsupported. |
| LONG-029 | Card data: Database/spoiler update and artwork source management | P2 | Complete (was Partial) | `parity/20-card-data` | Database download stays a file pick. Catalog scheduling, caching, freshness and fallback hardening remain backlog after `parity/r4-scryfall-catalog`. |
| LONG-030 | Card data: Set, custom card/token, and preferred-art management | P2 | Complete (was Missing) | `parity/20-card-data` | Set/preferred-art/custom-token management delivered; token multicolor handling and annotation remain backlog. |
| LONG-031 | Updates: Client version and update checks | P3 | Out of scope (was Divergent) | — | See [Out of scope](#out-of-scope-for-a-browser-client). |
| LONG-032 | Extensibility: Plugin discovery and management | P3 | Out of scope (was Unverified) | — | See [Out of scope](#out-of-scope-for-a-browser-client). |
| LONG-033 | Desktop integration: Fullscreen, tray, folders, intents, status, and tips | P3 | Out of scope (was Divergent) | — | See [Out of scope](#out-of-scope-for-a-browser-client). |

### Cockatrice 3.1 features outside the audit

The audit predates these Cockatrice master additions. `parity/03-protocol` brought in the protocol for all of them.

| Feature (Cockatrice PR) | Status | Branch |
|---|---|---|
| Reports and moderation queue (#7091) | Complete; private-chat conversation evidence remains backlog | `parity/14-reports`, `parity/13-administration` |
| Developer staff role (#7211) | Complete | `parity/12-moderation-users`, `parity/10-account-auth`, `parity/13-administration` |
| Live metrics developer tab (#7212) | Complete | `parity/13-administration` |
| Card art rules | Complete | `parity/13-administration` |
| Playmats (#7101) | Partial: board rendering, collection, crop and selection settings delivered; per-deck authoring and direct-manipulation crop preview remain | `parity/23-playmats`; card presentation/backgrounds in `parity/25b-board-prefs` |
| Command round-trip latency (#7153) | Complete; client-side measurement also works on 3.0 servers | `parity/23-playmats` |
| Deck share links (#7241) | Partial: create/copy/open/import/revoke for decks and folders delivered; sharing a hand-picked multi-deck selection remains | `parity/23d-deck-share` |
| Public decks (#7241) | Complete: publish/unpublish decks and folders, public/inherited badges, browse/import another user's decks | `parity/23d-deck-share` |

## Out of scope for a browser client

Each claim was checked against Cockatrice `add65ca`.

| Item | Desktop | Why not in Webatrice |
|---|---|---|
| Local/offline game (LONG-005) | `MainWindow::startLocalGame` runs an in-process `LocalServer`, a subclass of the C++ `Server` in `libcockatrice_network/.../server/remote/`, with one `LocalClient` per seat. | Webatrice has no game server; Servatrice's C++ game logic decides every move. Offline play would mean porting that server to the browser and keeping it in step. A one-seat game on any server covers goldfishing. |
| Client auto-update (LONG-031) | `ClientUpdateChecker` and `ReleaseChannel` find a release; `DlgUpdate` downloads the installer and runs it with `QProcess::startDetached`. | Reloading the page loads the deployed build, so deployment is the update. |
| Plugins (LONG-032) | `main.cpp` only adds `<app dir>/plugins` to Qt's library path, for Qt's own runtime plugins. | There is no user plugin feature to match. |
| Tray, single instance, file associations, fullscreen, folders (LONG-033) | `QSystemTrayIcon` (`window_main.cpp`, `tab_supervisor.cpp`, `tab_message.cpp`); `SingleInstanceManager` over `QLocalServer`; installers register `.cod` (`cmake/NSIS.template.in`, `cmake/Info.plist`) and the `cockatrice://` scheme (`Info.plist`, `cockatrice.desktop`); `actFullScreen`; `actOpenSettingsFolder` and the custom-folder actions. | A page cannot own a tray icon, register file types or URL schemes, or open OS folders, and tabs replace single-instance handoff. The browser covers the outcomes: its own fullscreen, `.cod`/`.cor` file pickers, browser notifications (PLAT-023), and `cockatrice://joingame` links in chat (`parity/16-game-lobby`). |
| On-disk paths and picture cache (part of LONG-015) | `GeneralSettingsPage` path pickers for decks, filters, replays, pictures and card databases; picture-cache method, size, TTL and naming. | Data lives in the origin's IndexedDB and images in the browser's HTTP cache, which a page cannot read or clear. `parity/21-appearance-i18n-diag` shows storage usage and offers targeted clears. |
| Automatic reconnect (PLAT-006) | `ConnectionController::onSocketError` / `onServerTimeout` show an error and reopen the Connect dialog; `RemoteClient` never re-authenticates by itself. On the next login Servatrice re-attaches the user's games (`Server_AbstractUserInterface::joinPersistentGames`, `Event_GameJoined.resuming`). | Webatrice matches desktop: a dropped connection lands on Login with "Connection lost — please log in again", and the server resumes games on login. Re-authenticating automatically would mean keeping credentials after login, which desktop does not do either. |

## PR series

### Merge order

This is the final linear stack: each PR is reviewed against the preceding branch, and its tip is `final/<row>`.
The PR body is `.parity-run/prs/parity-<row>.md`; titles below are those files' H1s. The first row stacks on
upstream master. Numbers 07 and 08 were not used. Accessibility audit IDs in the closure column are separate
from the 94 parity IDs. A partial contribution does not close the whole matrix row.

| # | Branch | Title | Rows closed / partial contribution | Stacks on |
|---|---|---|---|---|
| 1 | `parity/01-lint` | fix(webatrice): make the lint gate green and enforce it in CI | — (gate/hygiene) | Upstream master |
| 2 | `parity/02-hand-reorder` | fix(game): reorder hand cards on same-zone drag | — (GAME-016 / GAME-019 regression) | `parity/01-lint` |
| 3 | `parity/03-protocol` | feat(protocol): move to the Cockatrice 3.1 protocol with full Sockatrice command coverage | PLAT-003, PLAT-013; PLAT-002 synchronization described in Summary | `parity/02-hand-reorder` |
| 4 | `parity/12-moderation-users` | feat(moderation): desktop's moderator/admin user actions everywhere, warn list, replay grant, force activate, log search | LONG-006, LONG-024 | `parity/03-protocol` |
| 5 | `parity/04-command-outcomes` | feat: total command outcomes, crash containment and server notices | PLAT-004, PLAT-008 (generic notices), PLAT-027 | `parity/12-moderation-users` |
| 6 | `parity/10-account-auth` | feat: account self-service, activation login, public server discovery and user-menu navigation | PLAT-010, PLAT-012, PLAT-014, PLAT-015, LONG-019 | `parity/04-command-outcomes` |
| 7 | `parity/11-rooms-chat-users` | feat(rooms,chat,users): desktop-parity room joins, room and private chat feedback, and "Show this user's games" | PLAT-017, PLAT-018, PLAT-021, PLAT-022, PLAT-025, LONG-022 (with stated follow-ups) | `parity/10-account-auth` |
| 8 | `parity/13-administration` | feat(staff): Administration, Moderation, Card Art Rules and Developer pages | LONG-026, LONG-027 | `parity/11-rooms-chat-users` |
| 9 | `parity/06-e2e-hardening` | test(e2e): make the browser e2e hermetic and fix the worker that never exits | — (test infrastructure) | `parity/13-administration` |
| 10 | `parity/15-replays` | feat(replays): replays tab, local replay library and replay playback | LONG-001, LONG-002, LONG-003, LONG-004 | `parity/06-e2e-hardening` |
| 11 | `parity/14-reports` | feat: report users, My Reports and the moderator report queue (Cockatrice #7091) | LONG-023, LONG-025; PLAT-008 report notices | `parity/15-replays` |
| 12 | `parity/19-settings` | feat(settings): desktop settings page, chat preferences, sound and notifications | LONG-008, LONG-011, LONG-013, LONG-014, PLAT-023; LONG-010 partial | `parity/14-reports` |
| 13 | `parity/21-appearance-i18n-diag` | feat(settings): appearance palettes, every UI language, storage controls and a debug log | LONG-007, LONG-015; LONG-012 palette only; LONG-016 partial | `parity/19-settings` |
| 14 | `parity/20-card-data` | feat(webatrice): card database management — sources, reload, Manage sets, custom tokens and picture URL templates | LONG-028, LONG-029, LONG-030 | `parity/21-appearance-i18n-diag` |
| 15 | `parity/24-platform-gates` | feat(shell): declare supported browsers, preflight required APIs, and gate e2e typecheck + forced-drop reconnect | PLAT-026, PLAT-028 | `parity/20-card-data` |
| 16 | `parity/23-playmats` | feat: Cockatrice 3.1 playmats and command round-trip latency | LONG-012 partial; PLAT-002 follow-up; RTT outside audit | `parity/24-platform-gates` |
| 17 | `parity/05-refactor-seat` | refactor(game): split PlayerBox into the seat model and existing game owners | GAME-018; otherwise refactor | `parity/23-playmats` |
| 18 | `parity/09-refactor-decks` | refactor(webatrice): split the deck list and deck editor by responsibility | — (refactor) | `parity/05-refactor-seat` |
| 19 | `parity/18-decks` | feat(webatrice): deck folders, undo/redo, legality, banner/tags, sample hand and online services | GAME-002, GAME-004, GAME-005, GAME-007, GAME-009; GAME-006 stays Partial | `parity/09-refactor-decks` |
| 20 | `parity/23d-deck-share` | feat(decks): Cockatrice 3.1 deck share links and public decks (#7241) | Outside audit: public decks; share links partial (multi-select sharing open) | `parity/18-decks` |
| 21 | `parity/16-game-lobby` | feat(game): desktop parity for the pre-game lobby: force start, sideboarding before ready, game invites and links | GAME-013, GAME-014, GAME-033 | `parity/23d-deck-share` |
| 22 | `parity/17a-game-actions` | feat(game): game menu with reverse turn, next phase with action and view rotation, plus three pinned fixes | GAME-028, GAME-029, GAME-030 | `parity/16-game-lobby` |
| 23 | `parity/17b-game-menus` | feat(game): card and player menus: related cards, reveal to, hide, tally, custom zones, deck in editor, Say | GAME-021, GAME-027; GAME-023 partial | `parity/17a-game-actions` |
| 24 | `parity/26-a11y-primitives` | fix(a11y): shared dialog focus, a keyboard menu primitive, live regions and contrast tokens | LONG-017 progress: accessibility P4–P6, P8–P12, P14, P16; P18 partial | `parity/17b-game-menus` |
| 25 | `parity/27-a11y-keyboard-paths` | fix(a11y): keyboard paths for platform lists and nav | LONG-017 progress: accessibility P1–P3, P7, P13, P15, P17, P19 | `parity/26-a11y-primitives` |
| 26 | `parity/28-i18n-gate` | feat(i18n): i18n CI gate, no-literal-string lint, and platform string extraction | LONG-016 partial: platform extraction and CI gate | `parity/27-a11y-keyboard-paths` |
| 27 | `parity/25a-platform-prefs` | feat(settings): platform preferences, deck opening and bracket-analysis consent | LONG-010 partial; LONG-011 mention completer; LONG-008 startup/version additions | `parity/28-i18n-gate` |
| 28 | `parity/r1-card-ops-seam` | refactor(game): one card-ops and targeting seam | — (refactor) | `parity/25a-platform-prefs` |
| 29 | `parity/25b-board-prefs` | feat(game): desktop's board preferences and card presentation options | LONG-012 (with stated follow-ups); LONG-010 game portion only | `parity/r1-card-ops-seam` |
| 30 | `parity/r2-zone-view-family` | refactor(game): share the zone-view dialog family | — (refactor) | `parity/25b-board-prefs` |
| 31 | `parity/r6-game-listeners` | refactor(datatrice): split game listeners by domain | — (refactor) | `parity/r2-zone-view-family` |
| 32 | `parity/r4-scryfall-catalog` | refactor(cards): Scryfall client and card-catalog layers | — (refactor) | `parity/r6-game-listeners` |
| 33 | `parity/17c-shortcuts` | feat(shortcuts): desktop's game shortcut catalogue | LONG-009 (shortcut-catalogue claim); extends baseline GAME-031 | `parity/r4-scryfall-catalog` |
| 34 | `parity/29-game-a11y-1` | fix(a11y): keyboard-operable game board, part 1 (C1) | LONG-017 progress: accessibility G8, G9, G11–G18 (C1); G1 already in 17a | `parity/17c-shortcuts` |
| 35 | `parity/30-game-a11y-2` | feat(a11y): keyboard-operable game board, part 2: cards, piles, menus and target picks (C2) | LONG-017 progress: accessibility G2–G7, G10, G19 (C2); closes game accessibility batch C with 29 | `parity/29-game-a11y-1` |
| 36 | `parity/r3-log-lobby` | refactor(datatrice,game): structured game-log entries and the lobby split | — (refactor and departure-log fix) | `parity/30-game-a11y-2` |
| 37 | `parity/31-deck-i18n-a11y` | feat(decks): finish deck i18n and make the deck editor keyboard- and screen-reader-usable | LONG-016 deck portion; LONG-017 progress: deck accessibility D1–D6 | `parity/r3-log-lobby` |
| 38 | `parity/32-game-i18n` | fix(game): translate the game board, menus, dialogs and lobby | LONG-016 game portion only | `parity/31-deck-i18n-a11y` |
| 39 | `parity/r5-topbar` | refactor(layout): split TopBar | — (refactor) | `parity/32-game-i18n` |
| 40 | `parity/t1-test-memory` | test: keep the webatrice unit suite under 3 GB in one run, and run integration on a VM pool (Vitest 5, vmForks, order-dependent specs) | — (test infrastructure) | `parity/r5-topbar` |
| 41 | `parity/33-hand-sort-local` | fix(game): sort the hand locally, as desktop does | GAME-019 (last gap: local hand sorting) | `parity/t1-test-memory` |
| 42 | `parity/34-replay-reveals` | fix(game): reveal cards during replay playback, skipping them while seeking | — (LONG-002 reveal-window follow-up) | `parity/33-hand-sort-local` |
| 43 | `parity/35-scryfall-search-errors` | fix(decks): report a failed Scryfall card search instead of showing no results | — (Webatrice-specific search error fix; GAME-003 context) | `parity/34-replay-reveals` |
| 44 | `parity/36-stack-play-x` | fix(game): play a card onto the end of the stack from every path | — (GAME-022 wire-order follow-up) | `parity/35-scryfall-search-errors` |
| 45 | `parity/22-parity-docs` | docs: add the Cockatrice parity status and PR series guide | — (this file); records PLAT-006 and LONG-005/031/032/033 decisions | `parity/36-stack-play-x` |

### Reviewer guide

- **Gate and test infrastructure.** 01 enables hooks lint and CI, with Auto Connect and deck-autosave fixes.
  06 makes browser tests hermetic and fixes the worker shutdown. 24 adds browser support declarations, startup
  preflight, e2e typecheck and forced-drop/re-login coverage. 28 adds the i18n gate and extracts platform strings;
  31 and 32 finish the deck/game extraction. t1 bounds unit-suite memory, moves integration to a VM pool and
  includes click-to-play lifetime, WebKit scroll and connection-drop assertion fixes. 22 records the final series.
- **Protocol only.** 03 vendors Cockatrice `add65ca`, regenerates protocol code and supplies every new Sockatrice
  command builder, with minimal Datatrice state. It also maps two login failures and the client-version string.
  Review wire shapes and capability minimum versions against the desktop and Servatrice references in its PR.
- **Refactors.** 05 splits the seat, adds zone-view selection (GAME-018), fixes drag permissions and makes the
  existing seat shortcuts rebindable. 09 splits the deck list/editor. r1 owns card operations and targeting;
  r2 shares zone views; r6 splits game listeners; r4 separates Scryfall transport and the card catalog;
  r3 structures game-log entries and splits the lobby; r5 splits TopBar. Read each PR's stated behaviour fixes
  as well as its characterization coverage; these are not all behaviour-neutral changes.
- **Small fix.** 02 restores same-zone hand reordering, including stable multi-card moves.
- **Features.** 04 covers command outcomes and containment; 10–14 account, chat and staff workflows; 15 replays;
  16 the game lobby; 18 decks; 19–21 settings, card data and appearance; 23 playmats/RTT; 23d sharing/public decks;
  17a/17b/17c game actions, menus and shortcuts; 25a/25b preferences. 26/27 and 29/30/31 cover shared, platform,
  game and deck accessibility; 28/31/32 cover localization. 33 is a feature/data fix: Datatrice owns the local
  zone reorder, and Webatrice sorts the hand without game commands. 34 carries replay reveal options through
  Sockatrice and Datatrice to Webatrice's read-only reveal dialog. 35 reports Scryfall search failures in the UI;
  it has no desktop equivalent. 36 fixes the remaining stack-play wire positions, including hand-card arrow
  auto-play. Review the desktop references where applicable; these follow-ups add no matrix-row closures.
  Staff actions need role checks; reports, playmats, deck sharing and parts of administration need the relevant
  3.1 capability. RTT also works on 3.0. Check capability-specific minimums rather than assuming every 3.1 beta
  supports every feature. The 3.1-only browser cases use the local master server image where each PR states it;
  recorded checks are evidence for that PR, not a claim that every remaining backlog item has been verified.
