import { initAnalytics, trackEvent } from './analytics';

const GTAG_SRC_PREFIX = 'https://www.googletagmanager.com/gtag/js?id=';

function gtagScripts(): HTMLScriptElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLScriptElement>(`script[src^="${GTAG_SRC_PREFIX}"]`),
  );
}

function setKey(key: string | undefined): void {
  window.Cockatrice = { env: { RR_GA_KEY: key } };
}

describe('analytics', () => {
  beforeEach(() => {
    delete window.gtag;
    delete window.dataLayer;
    delete window.Cockatrice;
    gtagScripts().forEach(script => script.remove());
  });

  describe('initAnalytics', () => {
    it('bootstraps gtag when a valid measurement id is injected', () => {
      setKey('G-C62JKV3X8Q');

      initAnalytics();

      expect(typeof window.gtag).toBe('function');
      const scripts = gtagScripts();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].src).toBe(`${GTAG_SRC_PREFIX}G-C62JKV3X8Q`);
      expect(scripts[0].async).toBe(true);
      // gtag('js', <Date>) + gtag('config', id) both recorded on the dataLayer.
      expect(window.dataLayer).toContainEqual(['config', 'G-C62JKV3X8Q']);
      expect(window.dataLayer?.some(entry => Array.isArray(entry) && entry[0] === 'js')).toBe(true);
    });

    it('no-ops when no key is set (empty string)', () => {
      setKey('');

      initAnalytics();

      expect(window.gtag).toBeUndefined();
      expect(gtagScripts()).toHaveLength(0);
    });

    it('no-ops when the runtime config is absent', () => {
      initAnalytics();

      expect(window.gtag).toBeUndefined();
      expect(gtagScripts()).toHaveLength(0);
    });

    it('is idempotent — does not re-inject when already initialized', () => {
      setKey('G-C62JKV3X8Q');

      initAnalytics();
      initAnalytics();

      expect(gtagScripts()).toHaveLength(1);
    });
  });

  describe('trackEvent', () => {
    it('no-ops when analytics was never initialized', () => {
      expect(() => trackEvent('deck_opened', { format: 'standard' })).not.toThrow();
      expect(window.dataLayer).toBeUndefined();
    });

    it('records an event on the dataLayer after init', () => {
      setKey('G-C62JKV3X8Q');
      initAnalytics();

      trackEvent('game_deck_submitted', { format: 'commander' });

      expect(window.dataLayer).toContainEqual([
        'event',
        'game_deck_submitted',
        { format: 'commander' },
      ]);
    });
  });
});
