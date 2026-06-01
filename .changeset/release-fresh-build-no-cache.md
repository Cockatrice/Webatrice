---
---

Build/CI-internals only — no published output change.

The release workflow now builds `@cockatrice/sockatrice` and `@cockatrice/datatrice` from source instead of restoring the shared content-addressed dist cache. A publish must never consume a stale or partial cached dist: a CI build cancelled between `tsup` and the `tsc --emitDeclarationOnly` pass can save a declaration-less `dist` under the cache key, which a later release then hits and fails datatrice's `prepack` dts build (`'WebClient' refers to a value, but is being used as a type`). The `build-libraries` action gains a `cache` input (default `'true'`); both release jobs pass `cache: 'false'`, while CI test jobs keep the cache since they only need the runtime JS.
