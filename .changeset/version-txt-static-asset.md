---
'@cockatrice/webatrice': patch
---

Replace `src/server-props.json` with `public/version.txt`. The commit SHA is now written to a real static asset the deployed site exposes at `/version.txt`, and the in-app version footer fetches it at runtime via a new `useVersion()` hook instead of importing a bundled JSON. Restores the deploy smoke test's ability to verify which commit is actually live.
