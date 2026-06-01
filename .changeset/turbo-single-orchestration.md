---
---

Build-internals only — no published output change.

Remove the TypeScript project-references / `composite` layer and make Turborepo the single build orchestrator. Previously the incremental `tsBuildInfoFile` could make sockatrice's separate `tsc --emitDeclarationOnly` pass silently no-op, so turbo cached a declaration-less `dist` and consumers' dts build failed with `'gameId' does not exist in type 'MessageInit<Message>'`. Declaration emit is now non-incremental and always runs; cross-package typecheck moves to `turbo run typecheck` (which builds deps via `^build` first).
