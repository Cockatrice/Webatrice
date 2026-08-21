---
'@cockatrice/webatrice': minor
---

Card preview polish: pop-out window, image/text/both view toggle, related-card navigation with back stack, resizable sidebar, phase-tracker auto-hide toggle, and full i18n coverage for shortcut labels.

**Pop-out preview.** A new "Pop out" button in the sidebar's Preview header spawns a small browser window (`/card-preview-popup`) that mirrors the currently hovered card via `BroadcastChannel` — Cockatrice-parity for moving the preview to a second monitor. The popup does not do its own Scryfall fetch; the main window ships the fetched detail on the channel so both surfaces render the same content without racing. A heartbeat/watchdog pair distinguishes "quiet" from "disconnected" so the popup flips to a dimmed "Reconnecting…" state (without closing) when the main window refreshes, and pulls back once broadcasts resume.

**Image / Text / Both view.** The Preview header gains an icon-only segmented control matching Cockatrice's three view modes. Selection persists globally in `localStorage`. In "both" mode the sidebar stacks image over text; the popup uses explicit `vh`-based slots so a long oracle can never push the image off-screen.

**Related-card navigation with back stack.** `CardRelatedLinks` now renders inside the popup as well, and clicking a link swaps the preview to that card. The sidebar's related-link override is now a stack so chains (card → token → combo piece) can be walked; a `← Back to {previous card}` button appears at the top of the text pane in both surfaces and pops one entry at a time. Hovering a different card in the main window resets the stack. Popup navigation posts back to the main window so both surfaces stay in sync (no independent popup state to drift).

**Resizable sidebar.** A new `SidebarResizer` drag handle resizes the right rail; width persists across sessions via `useSidebarWidth` and drives the game grid's `--sidebar-width` column.

**Phase tracker auto-hide toggle.** The phase tracker's auto-hide behaviour is now user-controllable via a new toggle (default: pinned).

**Fallback card art sizing.** The "Hover a card" placeholder in the popup now uses the same `aspect-[5/7]` sizing rules as `CardImage` — filling the "both"-mode height slot or the full pane width in single-pane — instead of being capped at a fixed 320px.

**Shortcut labels.** `ShortcutsTab.i18n.json` now covers all 71 default action IDs (was 14). Missing labels were rendering the raw `ShortcutsTab.action.game.*` key in the settings tab.
