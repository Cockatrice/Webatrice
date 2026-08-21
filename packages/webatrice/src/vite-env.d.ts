/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

// Ambient globals. This file has no imports/exports, so it's already global
// scope — `interface Window` merges into the DOM lib's Window without a
// `declare global` wrapper.
interface Window {
  // gtag()'s real overload set is enormous (js, config, event, get, set,
  // consent…). We only invoke `event` from app code, so a loose rest-args type
  // keeps the surface minimal without pulling in @types/gtag.
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  // Namespaced runtime config injected per-deploy by public/env.js
  // (overwritten by .github/workflows/deploy.yml from the RR_GA_KEY variable).
  Cockatrice?: {
    env?: {
      RR_GA_KEY?: string;
    };
  };
}
