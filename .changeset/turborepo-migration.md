---
---

Adopt Turborepo for monorepo task orchestration, replacing the hand-rolled `npm-run-all2` (`run-p`) scripts. No package behavior changes — tooling only, so no version bumps.

- **`turbo.json`** defines the task graph: `build`/`typecheck`/`test`/`test:integration` depend on `^build`, `dev` is a `persistent` non-cached service. Repo-root inputs (`tsconfig.base.json`, vendored `*.proto`) live in `globalDependencies`; per-package `inputs`/`outputs` drive content-hash caching (warm `build` is a sub-second cache replay).
- **Consistent task names.** The long-running dev/watch task is `dev` in every package (sockatrice/datatrice renamed from `watch`, webatrice from `start`). webatrice's `prestart` hook became `predev` so `prebuild.js` still generates i18n/server-props before the Vite dev server.
- **Root scripts** route through `turbo run` (`start`→`dev`, `build`, `lint`, `typecheck`, `test`, `golden`). Test scripts pin `--concurrency=1`: Turbo parallelizes package vitest suites and webatrice's `maxWorkers: '75%'` vmThreads pool oversubscribes the CPU otherwise, causing spurious worker-crash failures.
- **Deps.** `npm-run-all2` removed, `turbo` added; a `packageManager` field is required by Turbo 2.9+. `.turbo` is gitignored.

The `tsBuildInfoFile` and `dts: false` build fixes in sockatrice are orthogonal and unchanged. CI/release workflows already call per-package scripts that were not renamed, so they are unaffected.
