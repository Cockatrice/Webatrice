---
'@cockatrice/webatrice': patch
---

Fix toasts silently failing after a language change. `useToast` captured its
`children` once at registration and `OPEN_TOAST` silently no-oped when the entry
was absent, so switching the UI language (which suspends and re-registers the
toast subtree) could leave host add/edit/delete showing no toast and no console
warning. `openToast` now accepts fire-time content and upserts the entry
(create-or-update, then open), so it can't silently drop; a new `updateToast`
keeps registered content current when the language changes; and an unregistered
no-arg open logs a DEV warning instead of vanishing. `KnownHosts` computes its
toast text at fire time, which also fixes edit/delete toasts previously
mislabeled as "created". Backward-compatible for existing no-arg `useToast`
callers.
