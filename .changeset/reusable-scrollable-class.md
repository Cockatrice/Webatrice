---
'@cockatrice/webatrice': patch
---

Consolidated all thin-scrollbar styling into a single reusable `.scrollable` class (in `styles/thin-scrollbar.css`) driven by two CSS custom properties — `--thin-scrollbar-color` and `--thin-scrollbar-gutter` — plus a `.no-gutter` modifier for elements that shouldn't reserve gutter space. Every scrolling container in the app now opts in via this class: the five game-area scroll regions (card preview back, game log, hand zone, stack column, battlefield), the in-game dialogs (zone view, sideboard, create-token), and every page-level scroll surface (app routes, account, server, login, room, logs, game selector, settings panel). The old `.overflow-scroll` utility class and its scattered per-component `scrollbar-width` / `scrollbar-color` / `::-webkit-scrollbar*` rules are gone — scrollbars are now thin, translucent, and consistent across the app, with stable gutter (no layout shift) on the elements that need it.
