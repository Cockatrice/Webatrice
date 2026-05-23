---
'@cockatrice/webatrice': patch
'@cockatrice/sockatrice': patch
---

E2E env files moved from `packages/<pkg>/e2e/docker/.env` to `packages/<pkg>/.env.e2e`. The `.env.e2e` suffix (not plain `.env`) prevents Vite/vitest from auto-loading the docker-compose vars during dev/test/build.
