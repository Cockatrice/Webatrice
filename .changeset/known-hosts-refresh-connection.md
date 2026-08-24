---
'@cockatrice/webatrice': patch
---

Add a refresh button to the known-hosts selector that re-runs the connection
test for the currently selected host. It sits inline in the closed selector, to
the left of the dropdown chevron, and spins while a probe is in flight. Probes
otherwise only fire on host selection, so a host that was briefly unreachable
(e.g. a local server just started) previously required re-selecting the host to
re-test — this gives users a direct way to retry.

This also removes the now-dead known-hosts recovery effect that re-probed
whenever `testConnectionStatus` went `null`. That effect only existed to recover
from a disconnect wiping the probe result; with the result now carried through
the reset reducers, it produced redundant probes that counted against
Servatrice's per-IP connection cap. Probes now fire solely on genuine user
actions — host selection, pick, or the new refresh button.
