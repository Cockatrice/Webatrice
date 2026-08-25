---
'@cockatrice/datatrice': minor
'@cockatrice/webatrice': minor
---

Sort user and game lists using the active UI language's collation instead of the OS/browser default.

**datatrice.** `SortUtil` now accepts an optional BCP-47 `locale` (per-locale `Intl.Collator` cache; `undefined` keeps the environment default). The server slice gains a `locale` field and a `setLocale` action (preserved across `initialized`/`clearStore`/`disconnected` resets so it survives a reconnect), and the memoized sorted selectors (`getSortedUsers`/`getSortedBuddyList`/`getSortedIgnoreList`, `getSortedRoomGamesBase`/`getSortedRoomUsers`) take `locale` as an input so a language change re-collates immediately rather than waiting for the next roster/sort change.

**webatrice.** A `useSyncLocaleToStore` hook mirrors the active i18next language (normalized via `toBcp47`) into `server.locale` on mount and on every language change. The app's `<Suspense>` boundary moved from inside `AppShell` up to `index.tsx` — below `DatatriceProvider`/`WebClientProvider` but above all of `AppShell` — so a translation-load suspension (a non-bundled language fetching its namespace) resolves to that fallback without tearing down and reconstructing the `WebClient` singleton. Loading UX is unchanged.

**ICU fallback.** When an ICU message fails to parse or format — e.g. a malformed Transifex translation such as a missing `select` comma or localized ICU keywords — the i18next-icu `parseErrorHandler` now re-renders it from the bundled, validated English source instead of emitting the raw `{…}` template to users. A failing English source (our own bug) is left visible rather than masked.
