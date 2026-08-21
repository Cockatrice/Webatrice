---
'@cockatrice/webatrice': minor
---

Deck editor preloads card images with a skeleton loader, and Google Analytics is wired in to track daily usage and deck format distribution.

**Deck editor image preload + skeleton.** Opening a deck (especially the first time, or after a hard refresh) previously left hover-preview feeling laggy: card JSON was cached fast by the Dexie Scryfall layer but the actual image bytes only fetched on the first `<img>` mount, adding ~200–500ms of blank-then-pop per card. The editor now preloads every card's `normal`-sized preview URL up-front via `new Image()` so the browser HTTP cache is warm before the sidebar preview ever renders. During hydration + preload it shows a proper skeleton (mirrors the real 360px sidebar + main grid, `animate-pulse` placeholders, a `Preloading N/M cards…` progress line) instead of the old spinner. The gate uses a `readyDeckId` value guard so subsequent add / remove / printing-swap doesn't re-block the UI — only navigating to a different deck resets it. Image `onerror` counts as done so a single 404 can't stall the deck.

**Google Analytics.** The GA4 gtag snippet is loaded from `index.html` (measurement id `G-C62JKV3X8Q`), giving daily active users, session counts, and pageview totals out of the box. A small `src/services/analytics.ts` wraps `window.gtag` with a typed `trackEvent()` helper that safely no-ops when the tag isn't present (dev, offline, ad blockers). Two custom events fire on top of the automatic pageviews:

- `deck_opened { format }` — fires when the deck editor finishes hydrating a deck. Uses the normalized `HydratedDeck.format` (defaults to `commander` for legacy files without a `<format>` tag) so bucket labels match the editor UI.
- `game_deck_submitted { format }` — fires when a player submits a deck to a game via the deck-select dialog. Lightweight regex against the `.cod` XML pulls the `<format>` value; legacy files without one report `unknown` so those still surface as a bucket instead of being dropped.
