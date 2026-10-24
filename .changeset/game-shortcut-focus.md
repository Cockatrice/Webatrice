---
'@cockatrice/webatrice': patch
---

Tab and Shift+Tab move focus again inside dialogs and menus and between buttons and form fields during a game; they only advance the phase (Tab) or run Next phase with action (Shift+Tab) when focus is on the board or on a card there, including one you just clicked. Library, graveyard and other zone views count as dialogs, so Tab moves focus inside them. While a modal dialog is open, game, deck-editor, room and replay shortcuts are paused, so Escape closes the dialog instead of a zone view.
