---
---

Refactor CI/CD pipeline. See git history on the `cicd-pipeline-refactor` branch for per-commit detail.

- **Workflows split by concern.** `changesets.yml` owns the Version Packages PR; `release.yml` owns library publishes (GH Packages, via `changesets/action publish`) and the `@cockatrice/webatrice` GitHub Release. Releases gate per-package on `CHANGELOG.md` paths-filter so libraries and app publish only when their own version actually changed.
- **Composite actions.** `install-packages` (`npm clean-install --ignore-scripts` + optional webatrice prebuild) and `build-libraries` (content-addressed cache of `sockatrice/{dist,src/generated}` + `datatrice/dist`, vendor submodule init only on cache miss) replace ~5 duplicated step sequences across CI jobs.
- **Security hardening.** Third-party actions SHA-pinned; `--ignore-scripts` on install; `persist-credentials: false` on read-only checkouts; sigstore `NPM_CONFIG_PROVENANCE` on library publishes; `actions/attest-build-provenance` on the webatrice tarball with `gh attestation verify` enforced at deploy time.
- **Deploy.** `deploy.yml` takes an `environment` input (stage-only today, prod reserved), reads `vars.SITE_URL` from the chosen GitHub Environment, verifies the artifact's provenance, then smoke-tests the deployed site by polling `${SITE_URL}/server-props.json` for the expected `REACT_APP_VERSION`. StrictHostKeyChecking on the SSH sync.
- **E2e robustness.** Rooms-list waits now key on the LeftNav connection indicator + an explicit logo click, eliminating a flaky race with Servatrice's auto-join-room-0 behavior. Container logs are dumped before tear-down so failures retain diagnostics.
- **Misc CI.** `changeset status --since=origin/master` (so it resolves under detached-HEAD checkouts on both PR and master pushes); `fetch-depth: 0` on typecheck; consistent human-readable job/step names throughout.
