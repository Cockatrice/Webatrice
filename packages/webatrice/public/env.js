// Runtime environment config, read by src/services/analytics.ts.
//
// Overwritten per-environment at deploy time from the RR_GA_KEY Actions
// variable (see .github/workflows/deploy.yml). This committed default leaves
// the key empty, so analytics stays disabled in dev/preview/CI and in any
// environment that doesn't set the variable.
//
// Assigned onto window (rather than exported) because this is a static asset
// served verbatim at /env.js, outside the Vite build graph — the app can't
// import it, so it reads the value off the global namespace instead.
window.Cockatrice = window.Cockatrice || {};
window.Cockatrice.env = { RR_GA_KEY: "" };
