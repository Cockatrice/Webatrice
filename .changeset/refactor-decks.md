---
'@cockatrice/webatrice': patch
---

Internal refactor of the deck list and deck editor. The deck pages, card-detail dialog and breakdown panel are split into tested pure modules (grouping, search query, stats, import/export, pricing, card detail), hooks that own state and persistence (deck list, autosave, pricing, card search, bracket assessment) and small presentational components. Characterization specs pin the Sockatrice commands and visible output of both pages.

Fix: the bracket estimate no longer treats a failed, timed-out or malformed Commander Spellbook or Scryfall response as "no combos" or "no Game Changers". Third-party calls now time out after 15 seconds; an incomplete estimate shows as a floor ("At least bracket N", with an "N+" level) with the failed sources and a Retry button, and only a complete assessment is saved to the deck. The section always names its data sources (Scryfall, and Commander Spellbook, which receives the deck's card names and quantities), and is fully translatable.

The deck dialogs are now announced as modal dialogs named by their headings.
