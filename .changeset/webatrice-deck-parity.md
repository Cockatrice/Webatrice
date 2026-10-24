---
'@cockatrice/webatrice': minor
---

The deck pages catch up with desktop's deck editor and deck storage:

- **Folders.** My Decks shows the server's folder tree one folder at a time, with a breadcrumb. You can create and delete folders (deleting says how many decks go with it), create or import decks into a folder, move a deck to another folder (a copy keeps its visibility and color identity, and the original is deleted only once the copy is saved; a failed move says so and leaves the original), and download a deck or a whole folder as `.cod` files.
- **Undo and redo.** Every card and metadata edit can be undone and redone, from the buttons, from Ctrl+Z / Ctrl+Y (rebindable in Settings → Shortcuts), or by jumping through the history list.
- **Legality.** Cards that are banned, not legal or over the allowed count in the deck's format are shown in red, with a summary in the sidebar. Imported format rules (allowed counts and exceptions) apply; cards or formats with no legality data say so instead of being flagged.
- **Banner card and tags** can be edited in the sidebar; unknown tag data and desktop's playmat card are kept.
- **Sample hand** with an adjustable size and redraw.
- **Print deck**, **Create decklist** on decklist.org / decklist.xyz, and **Analyze** on deckstats.net / tappedout.net. "Load deck from online service" recognizes Archidekt, Deckstats, Moxfield and TappedOut links; those sites don't let a web page read decks, so it opens the site's export for you to paste.

Autosave now uploads only when the deck actually changed (it used to upload on every scheduled save), goes through Sockatrice's `deckUpdate` with the deck's color identity (so 3.1 servers no longer lose it on every save), and reports a failed save with a Retry link.

The Commander bracket estimate no longer counts sideboard cards when it asks Commander Spellbook for combos, and sends designated commanders in Spellbook's own `commanders` list; moving a card between zones or changing the commander now re-checks a saved estimate.

The bracket estimate now asks before contacting Scryfall and Commander Spellbook. Until you choose "Allow online lookups" in the bracket section (remembered in this browser, and revocable from the same place), opening a deck sends nothing to either service; a bracket already saved with the deck still shows.
