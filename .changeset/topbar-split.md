---
'@cockatrice/webatrice': patch
---

Internal refactor of the top bar: its tab model, sticky-tab store, sign-in identity check, deck-name lookup and last-route persistence move into their own modules, and the user menu and tab strip become components. The top bar no longer fails to render when the browser blocks local storage: its sign-in identity check now tolerates it, as the saved tabs and last route already did.
