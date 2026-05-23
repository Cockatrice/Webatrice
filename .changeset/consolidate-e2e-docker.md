---
'@cockatrice/webatrice': patch
'@cockatrice/sockatrice': patch
---

E2E docker stacks consolidated into a single `docker/servatrice/` directory at the monorepo root. Each package now keeps only a tiny `e2e/docker/.env` (compose project name + host port) and invokes the shared compose via `docker compose --env-file e2e/docker/.env -f ../../docker/servatrice/docker-compose.e2e.yml ...`. One servatrice image tag, one schema, one ini, two `.env` files.

After pulling, run `docker volume prune` once to clean up the old project-prefixed volumes (`webatrice-e2e_webatrice_e2e_mysql`, `sockatrice-e2e_cockatrice_e2e_mysql`); the new stacks use `*_mysql_data`. The shared ini sets `maxnamelength=16` (was 12 for Sockatrice) — Sockatrice's 10-char generated usernames still fit, no behavioral change.
