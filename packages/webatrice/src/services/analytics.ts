/**
 * Thin wrapper around Google Analytics 4 (gtag.js). `initAnalytics()` bootstraps
 * the tag at app startup from the runtime GA measurement id (see below); the
 * rest of the app talks only to `trackEvent`, so we can swap providers, add
 * sampling, or inject a no-op stub for tests without hunting through the
 * codebase.
 *
 * The measurement id is supplied per-environment at deploy time via
 * `window.Cockatrice.env.RR_GA_KEY` (public/env.js, overwritten by
 * .github/workflows/deploy.yml from the RR_GA_KEY variable). It is optional —
 * when absent, `initAnalytics()` is a no-op and `window.gtag` is never defined.
 *
 * Every export is safe to call from any context — SSR, ad-blocked browsers, dev
 * without a key — because they all short-circuit when the key is missing or
 * `window.gtag` isn't a function. Analytics failures never take down
 * user-facing code.
 */

export type AnalyticsEventName =
  | 'deck_opened'
  | 'game_deck_submitted';

/**
 * Bootstrap Google Analytics if a measurement id was injected for this
 * environment. Idempotent and side-effect-free when the key is absent — safe to
 * call unconditionally at app startup. No-ops if already initialized.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (typeof window.gtag === 'function') {
    return;
  } // already initialized

  const measurementId = window.Cockatrice?.env?.RR_GA_KEY;
  if (!measurementId) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  const gtag: Window['gtag'] = (...args) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;

  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(loader);

  gtag('js', new Date());
  gtag('config', measurementId);
}

export function trackEvent(
  name: AnalyticsEventName,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const gtag = window.gtag;
  if (typeof gtag !== 'function') {
    return;
  }
  try {
    gtag('event', name, params);
  } catch {
    // Swallow — an analytics hiccup should never surface to the user.
  }
}
