---
'@cockatrice/webatrice': minor
---

Card database management, matching desktop's Card Database menu. The card-import dialog now has tabs for the Oracle import, the loaded data, Manage sets and custom tokens.

**Sources and reload.** Every imported file (cards.xml, tokens.xml, spoiler.xml, custom set files, editor tokens) is kept as a source, and the card tables are rebuilt from all of them in desktop's load order inside one transaction: the first file to define a card wins, later files add printings. Re-importing a file replaces the one of the same kind, custom sets can be added and removed, "Reload card database" re-derives everything, and a malformed file leaves the previous database untouched. The loaded-data tab lists each file with its counts, origin, version and import time.

**Updates.** Tokens and spoilers update straight from the URLs Oracle and desktop's spoiler updater use, including dropping spoiler.xml when spoiler season ends. "Check for card updates" compares the imported cards.xml with MTGJSON's current build and points at Oracle when a newer one exists.

**Manage sets.** Enable or disable sets, search, move sets to the top/up/down/bottom, restore the default order, or sort by a column and adopt it as the priority. The list works from the keyboard as desktop's does: arrows move and select, Shift extends, Ctrl moves without selecting, Space or Enter selects and Ctrl+A selects every set shown. The order decides which printing's art is shown and which printing the deck editor offers first. New sets found on import raise desktop's "New sets found" question.

**Custom tokens.** Add tokens (refusing names already in use), edit color, P/T and annotation, remove them and export them as `TK.xml`. The token list and the URL list below can be used from the keyboard (arrows to move, Space or Enter to select).

**Card sources.** Settings › Card Sources edits an ordered list of picture URL templates (desktop's defaults and placeholders), tried per printing after the card's own picture URL and before the Scryfall fallback; a failed image moves on to the next URL.

**Storage.** Settings › Storage counts the loaded card files, set preferences and download settings. "Delete card data" also removes the loaded files, so a reload cannot bring the cards back, and keeps the tokens made in the token editor, set preferences and download URLs.

Existing imports are migrated (Dexie v7) without a re-import or any copy of the cards during the upgrade: they become an "earlier import" source that loads after cards.xml, tokens.xml and spoiler.xml, so re-importing any of those takes over the cards it defines and nothing else is lost. It goes away once all three are imported again, or when removed from the loaded-data tab.
