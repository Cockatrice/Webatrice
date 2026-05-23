---
'@cockatrice/webatrice': patch
'@cockatrice/sockatrice': patch
---

Servatrice image tag moved out of `docker-compose.e2e.yml` into a root `.env.e2e` (substituted via `${SERVATRICE_IMAGE}`). Bumping the Servatrice release is now a one-line edit at the monorepo root.
