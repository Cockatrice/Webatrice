---
'@cockatrice/webatrice': minor
---

The deck list, deck editor, card search, deck breakdown and deck dialogs are now fully translatable: their remaining English text moved into the translation catalogue, counts use proper plural forms, and deck ages follow the UI language. Lint now rejects new hard-coded text in the decks feature.

Decks can now be built and shared with the keyboard and a screen reader alone. The deck list is one tab stop: the arrows, Home and End move between cards, Enter, + and Shift+→ add a copy, − and Shift+← remove one, Delete removes the card and Shift+S moves it between main deck and sideboard. Each card has an actions menu (Shift+F10 or the Menu key) with a new "Card details" entry. Quick add is a proper combobox that announces its suggestions, the advanced search field is named, and deck dialogs take focus, keep it inside and give it back when they close. New rebindable shortcuts in the deck editor: Save (Ctrl+S), New deck (Ctrl+Alt+N, since browsers keep desktop's Ctrl+N), Load deck (Ctrl+O), and add or remove a copy (+ / −).
