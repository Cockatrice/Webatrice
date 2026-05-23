---
'@cockatrice/webatrice': patch
'@cockatrice/sockatrice': patch
---

E2E `servatrice.sql` now comes from the pinned `ghcr.io/cockatrice/servatrice` image (extracted by a `servatrice-sql` sidecar into a shared volume that MySQL mounts at `/docker-entrypoint-initdb.d/`) instead of the Cockatrice submodule. The image tag is the single source of truth — schema and binary can't drift. The submodule still materializes `libcockatrice_protocol/` for proto generation.
