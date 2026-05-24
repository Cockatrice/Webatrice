# @cockatrice/webatrice

## 4.0.0

### Major Changes

- **Joined the unified monorepo release flow.** Webatrice now lives at `packages/webatrice/` alongside `@cockatrice/sockatrice` and `@cockatrice/datatrice`, with all three linked at v4.0.0 via [Changesets](../../.changeset/README.md). Subsequent changes that touch any of the three bump all three to the next shared version.
- **Versioning is now Changesets-driven.** The previous manual `npm version` bump in [`release.yml`](../../.github/workflows/release.yml) is gone; Changesets writes the version into `packages/webatrice/package.json` via the "Version Packages" PR. The downstream build / tarball / GitHub Release / deploy pipeline is unchanged in shape but reads the version from the manifest and tags releases as `@cockatrice/webatrice@<version>` to match the libraries' tag format.
- **Webatrice stays private.** Not published to GitHub Packages or any other registry; tarball-on-Release for `deploy.yml` remains the only distribution channel. Changesets honors `private: true` + `privatePackages.version: true` to version + tag without publishing.

### Notes

- Root manifest is now `cockatrice-web-stack` (private, version 0.0.0) — a thin orchestration package that owns `workspaces`, the shared `prepare` (submodule init + sockatrice codegen + husky), and a few cross-workspace convenience scripts. All app-specific scripts, dependencies, browserslist config, and configuration files now live under `packages/webatrice/`.
- Husky pre-commit hook updated to invoke `npm run -w @cockatrice/webatrice translate` and stage `packages/webatrice/src/i18n-default.json`.
