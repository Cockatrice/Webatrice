---
'@cockatrice/webatrice': patch
---

Make the Webatrice lint gate pass and enforce it in CI.

**Auto Connect now saves.** Ticking *Auto Connect* on the login form had stopped persisting the preference, so it reset on the next visit. The checkbox is wired back to its persist handler.

**Deck autosave after switching decks.** If the editor moved straight from one deck to another without unmounting, autosave could write one deck's contents under the other deck's id. The debounced save kept the first deck's id, and switching to a deck already opened this session kept showing (and saving) the previous deck. The editor now re-seeds from the open deck on every switch, and an edit still pending at the switch is saved to the deck it was made on.

**Lint.** `eslint-plugin-react-hooks` is installed (`rules-of-hooks` as an error, `exhaustive-deps` as a warning), every finding has been fixed or annotated, overlong lines are reformatted, and `TopBar` moves into page chrome so no shared layer imports a feature. CI now runs `npm run -w @cockatrice/webatrice lint`.
