---
'@cockatrice/webatrice': patch
---

Pipeline and bundle cleanup:

- Load the token library via a static `@app/services` import in the create-token dialog — the previous dynamic import was ineffective (the barrel is statically imported app-wide) and tripped a Vite build warning.
- Split heavy third-party vendors into separate chunks so the entry bundle stays under the size-warning limit and vendor code caches across deploys.
- Drop obsolete stub `@types` devDependencies (the real packages ship their own types) and repin `actions/cache` to a Node 24-compatible release ahead of GitHub's June 2026 Node 20 removal.
