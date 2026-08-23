---
'@cockatrice/webatrice': patch
---

Fix i18n breakage caused by underscore locale codes reaching JS `Intl` APIs, and repair language switching.

**ICU/`Intl` crash.** The active language could be a Cockatrice/Transifex-style underscore code (e.g. `pt_BR`, cached in `localStorage['i18nextLng']`), which is an invalid BCP-47 tag. `Intl.NumberFormat`/`Intl.PluralRules`/`Intl.Collator` reject it with `RangeError: Invalid language tag`, so every ICU format threw and i18next-icu silently returned the raw template — visibly, the account-age string rendered as `{years, plural, ...}` instead of `1 year, 1 day`. A new `toBcp47` helper normalizes underscore codes to hyphens only at the `Intl` boundaries: ICU's `parseLngForICU` and the `Intl.Collator` in `useLocaleSort`. The underscore form stays canonical everywhere else (the `Language` enum, `localStorage`, and the `public/locales/<code>` directories).

**Language switching.** The `I18nBackend.read` loader guarded on `language[Language]`, which always evaluated to `undefined`, so it never fetched any non-English locale file — selecting a different language did nothing. `read` now fetches `public/locales/<code>/<namespace>.json` by the raw code, with a 404 (e.g. bundled `en-US`) resolving to an empty resource.

**Diagnostics.** ICU's `parseErrorHandler` now logs format failures in dev instead of swallowing them silently.
