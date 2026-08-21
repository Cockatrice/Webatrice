/**
 * Thin wrapper around Google Analytics 4 (gtag.js). The tag itself is
 * loaded from `index.html`; this module is the one call-site the rest
 * of the app talks to so we can swap providers, add sampling, or
 * inject a no-op stub for tests without hunting through the codebase.
 *
 * Every export is safe to call from any context — SSR, ad-blocked
 * browsers, dev without the script tag — because they all short-circuit
 * when `window.gtag` isn't a function. Analytics failures never take
 * down user-facing code.
 */

declare global {
  interface Window {
    // gtag()'s real overload set is enormous (js, config, event, get,
    // set, consent…). We only invoke `event` from app code, so a loose
    // rest-args type keeps the surface minimal without pulling in
    // @types/gtag.
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEventName =
  | 'deck_opened'
  | 'game_deck_submitted';

export function trackEvent(
  name: AnalyticsEventName,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') return;
  const gtag = window.gtag;
  if (typeof gtag !== 'function') return;
  try {
    gtag('event', name, params);
  } catch {
    // Swallow — an analytics hiccup should never surface to the user.
  }
}
