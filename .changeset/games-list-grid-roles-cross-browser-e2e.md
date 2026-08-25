---
'@cockatrice/webatrice': patch
---

Restore accessible table semantics to the games list and run the app e2e suite
across Firefox and WebKit (Safari), not just Chromium.

The move to the virtualized `VirtualRows` dropped the games list's native `<tr>`
row semantics, leaving it as a flattened `role="list"` — assistive tech could no
longer navigate it by row or column. `GamesList` now exposes proper grid roles
(`role="table"`/`rowgroup`/`row`/`gridcell`/`columnheader`, with `aria-sort` and
`aria-rowcount`). `VirtualRows` gained a single optional `role` override so a
tabular consumer can make react-window's `<List>` a `rowgroup` (react-window
hardcodes `role="list"`, an invalid parent for `role="row"`); roster and chat
panels keep the `list` default.

CI now fans the app e2e job out into a `chromium` / `firefox` / `webkit` browser
matrix, each on its own runner and Servatrice stack. Validated locally green
(6/6 specs) on all three engines.
