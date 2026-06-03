---
"@cockatrice/datatrice": minor
---

Move the canonical zone-name wire constants to sockatrice.

`ZoneName` and `ZoneNameValue` were defined here and re-exported via the `Enriched`
namespace, but the zone wire strings are a Cockatrice protocol concern, so they now
live in `@cockatrice/sockatrice`. `Enriched.ZoneName` and `Enriched.ZoneNameValue` are
no longer exported — import `ZoneName` / `ZoneNameValue` from `@cockatrice/sockatrice`
instead (no convenience alias is kept). All internal datatrice references
(listeners, reducers, selectors, message log) were repointed; the `Enriched`
namespace is otherwise unchanged.
