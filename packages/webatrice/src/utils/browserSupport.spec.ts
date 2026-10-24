import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Language } from '../types/languages';
import { PREFERENCE_DEFAULTS, ThemeMode, ThemeName } from '../types/settings';
import { resolveSupportedLanguage } from './locale';

import browserFeatureI18n from '../features/shell/BrowserFeature.i18n.json';
import unsupportedI18n from '../features/shell/Unsupported.i18n.json';
import { getBrowserSupport, type BrowserFeature } from './browserSupport';

const PREFLIGHT = readFileSync(resolve(__dirname, '../../public/preflight.js'), 'utf8');
const PREFLIGHT_CSS = readFileSync(resolve(__dirname, '../../public/preflight.css'), 'utf8');
const TOKENS_CSS = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');

const bootThemeModeFallback = ThemeMode.Dark;

function cssBlocks(css: string): Map<string, Record<string, string>> {
  const blocks = new Map<string, Record<string, string>>();
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
    for (const selector of selectors.split(',')) {
      blocks.set(selector.trim(), tokens);
    }
  }
  return blocks;
}

class Stub {}
const stubFn = () => undefined;

type FakeWindow = Record<string, unknown> & { Cockatrice?: { browserSupport?: unknown } };

function supportedBrowser(overrides: Record<string, unknown> = {}): FakeWindow {
  return {
    document: { ...documentWithModules(), getElementById: (id: string) => document.getElementById(id) },
    Function,
    SyntaxError,
    BigInt: stubFn,
    WebSocket: Stub,
    crypto: { getRandomValues: stubFn, subtle: { digest: stubFn } },
    TextEncoder: Stub,
    structuredClone: stubFn,
    fetch: stubFn,
    AbortController: Stub,
    indexedDB: {},
    ResizeObserver: Stub,
    Worker: Stub,
    BroadcastChannel: Stub,
    navigator: { language: 'en-US', clipboard: { writeText: stubFn } },
    localStorage: { getItem: () => null },
    ...overrides,
  };
}

function documentWithModules(hasModules = true) {
  return {
    head: document.head,
    body: document.body,
    documentElement: document.documentElement,
    currentScript: null,
    createElement: (tag: string) => {
      const node = document.createElement(tag);
      if (tag === 'script' && hasModules) {
        Object.defineProperty(node, 'noModule', { value: false });
      }
      return node;
    },
  };
}

function runPreflight(win: FakeWindow) {
  new Function('window', PREFLIGHT)(win);
  return win.Cockatrice?.browserSupport as { missingRequired: BrowserFeature[]; missingOptional: BrowserFeature[] };
}

describe('public/preflight.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"><p>app</p></div>';
  });

  afterEach(() => {
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((style) => style.remove());
  });

  it('reports full support and leaves the page alone in a supported browser', () => {
    expect(runPreflight(supportedBrowser())).toEqual({ missingRequired: [], missingOptional: [] });
    expect(document.getElementById('root')!.innerHTML).toBe('<p>app</p>');
  });

  it('keeps window.Cockatrice set by env.js', () => {
    const win = supportedBrowser({ Cockatrice: { env: { RR_GA_KEY: 'G-1' } } });
    runPreflight(win);
    expect(win.Cockatrice).toMatchObject({ env: { RR_GA_KEY: 'G-1' } });
  });

  it.each<[BrowserFeature, Record<string, unknown>]>([
    ['bigInt', { BigInt: undefined }],
    ['webSocket', { WebSocket: undefined }],
    ['cryptoRandom', { crypto: { subtle: { digest: stubFn } } }],
    ['textEncoder', { TextEncoder: undefined }],
    ['structuredClone', { structuredClone: undefined }],
    ['fetch', { fetch: undefined }],
    ['fetch', { AbortController: undefined }],
    ['indexedDB', { indexedDB: undefined }],
    ['resizeObserver', { ResizeObserver: undefined }],
  ])('requires %s', (feature, overrides) => {
    expect(runPreflight(supportedBrowser(overrides))).toEqual({ missingRequired: [feature], missingOptional: [] });
  });

  it('requires ES module support (the `nomodule` property)', () => {
    const win = supportedBrowser();
    win.document = { ...documentWithModules(false), getElementById: (id: string) => document.getElementById(id) };
    expect(runPreflight(win).missingRequired).toEqual(['esModules']);
  });

  it('requires the syntax the bundle is built for', () => {
    const OldFunction = function OldFunction() {
      throw new SyntaxError('Unexpected token');
    };
    expect(runPreflight(supportedBrowser({ Function: OldFunction })).missingRequired).toEqual(['syntax']);
  });

  it('parses the syntax probe in this engine', () => {
    expect(runPreflight(supportedBrowser({ Function })).missingRequired).toEqual([]);
  });

  it('does not count a CSP that forbids eval as missing syntax', () => {
    const NoEval = function NoEval() {
      throw new EvalError('unsafe-eval');
    };
    expect(runPreflight(supportedBrowser({ Function: NoEval })).missingRequired).toEqual([]);
  });

  it.each<[BrowserFeature, Record<string, unknown>]>([
    ['webCrypto', { crypto: { getRandomValues: stubFn } }],
    ['worker', { Worker: undefined }],
    ['broadcastChannel', { BroadcastChannel: undefined }],
    ['clipboard', { navigator: { language: 'en-US' } }],
  ])('treats %s as optional', (feature, overrides) => {
    expect(runPreflight(supportedBrowser(overrides))).toEqual({ missingRequired: [], missingOptional: [feature] });
    expect(document.getElementById('root')!.innerHTML).toBe('<p>app</p>');
  });

  it('counts a feature whose host getter throws as missing', () => {
    const win = supportedBrowser();
    Object.defineProperty(win, 'indexedDB', {
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(runPreflight(win).missingRequired).toEqual(['indexedDB']);
  });

  describe('unsupported screen', () => {
    it('replaces the app root with a main landmark naming what is missing', () => {
      runPreflight(supportedBrowser({ WebSocket: undefined, ResizeObserver: undefined }));

      const root = document.getElementById('root')!;
      expect(root.children).toHaveLength(1);
      const main = root.querySelector('main.Unsupported')!;
      expect(main.querySelector('h1')!.textContent).toBe(unsupportedI18n.Unsupported.title);
      expect(main.textContent).toContain(unsupportedI18n.Unsupported.missing);
      expect([...main.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
        browserFeatureI18n.BrowserFeature.webSocket,
        browserFeatureI18n.BrowserFeature.resizeObserver,
      ]);
    });

    it('lists only required features, not optional ones', () => {
      runPreflight(supportedBrowser({ WebSocket: undefined, Worker: undefined }));
      expect(document.querySelectorAll('#root li')).toHaveLength(1);
    });

    it('carries each palette\'s tokens with their tokens.css values', () => {
      const appBlocks = cssBlocks(TOKENS_CSS);
      const preflightBlocks = [...cssBlocks(PREFLIGHT_CSS)].filter(([, tokens]) => Object.keys(tokens).length > 0);
      expect(preflightBlocks.length).toBeGreaterThan(1);
      for (const [selector, tokens] of preflightBlocks) {
        const scheme = /data-scheme='(\w+)'/.exec(selector)?.[1] ?? PREFERENCE_DEFAULTS.themeName;
        const theme = /data-theme='(\w+)'/.exec(selector)?.[1] ?? 'dark';
        const app = appBlocks.get(`:root[data-scheme='${scheme}'][data-theme='${theme}']`);
        for (const [token, value] of Object.entries(tokens)) {
          expect(value, `${selector} ${token}`).toBe(app?.[token]);
        }
      }
      expect(PREFLIGHT_CSS).toContain('rgb(var(--bg-base))');
    });

    it.each(Object.values(ThemeName).flatMap((name) => ['light', 'dark'].map((theme) => [name, theme])))(
      'covers the %s %s palette with the tokens.css values',
      (name, theme) => {
        const app = cssBlocks(TOKENS_CSS).get(`:root[data-scheme='${name}'][data-theme='${theme}']`)!;
        const applied = { ...cssBlocks(PREFLIGHT_CSS).get('.Unsupported') };
        for (const [selector, tokens] of cssBlocks(PREFLIGHT_CSS)) {
          const scheme = /data-scheme='(\w+)'/.exec(selector)?.[1];
          const mode = /data-theme='(\w+)'/.exec(selector)?.[1];
          if (mode === theme && (scheme === undefined || scheme === name)) {
            Object.assign(applied, tokens);
          }
        }
        for (const [token, value] of Object.entries(applied)) {
          expect(value, token).toBe(app[token]);
        }
      },
    );

    describe('theme', () => {
      afterEach(() => {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-scheme');
      });

      const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });
      const painted = () => [document.documentElement.dataset.theme, document.documentElement.dataset.scheme];

      it('paints the saved theme and palette', () => {
        runPreflight(supportedBrowser({
          WebSocket: undefined,
          localStorage: storage({ 'webatrice.themeMode': 'light', 'webatrice.themeName': 'carbon' }),
        }));
        expect(painted()).toEqual(['light', 'carbon']);
      });

      it.each([[true, 'dark'], [false, 'light']])('resolves System from the operating system (dark: %s)', (dark, expected) => {
        runPreflight(supportedBrowser({
          WebSocket: undefined,
          localStorage: storage({ 'webatrice.themeMode': 'system', 'webatrice.themeName': 'graphite' }),
          matchMedia: () => ({ matches: dark }),
        }));
        expect(painted()).toEqual([expected, 'graphite']);
      });

      it('boots like the app when nothing is saved: dark, in the default theme', () => {
        runPreflight(supportedBrowser({ WebSocket: undefined }));
        expect(painted()).toEqual([bootThemeModeFallback, PREFERENCE_DEFAULTS.themeName]);
      });

      it('keeps Midnight for a returning visitor who saved a palette before themes existed', () => {
        runPreflight(supportedBrowser({ WebSocket: undefined, localStorage: storage({ 'webatrice.themeMode': 'dark' }) }));
        expect(painted()).toEqual(['dark', ThemeName.Midnight]);
      });

      it('falls back to the defaults when storage is blocked or holds unknown values', () => {
        runPreflight(supportedBrowser({
          WebSocket: undefined,
          localStorage: { getItem: () => {
            throw new Error('blocked');
          } },
        }));
        expect(painted()).toEqual([bootThemeModeFallback, PREFERENCE_DEFAULTS.themeName]);
        runPreflight(supportedBrowser({
          WebSocket: undefined,
          localStorage: storage({ 'webatrice.themeMode': 'sepia', 'webatrice.themeName': 'neon' }),
        }));
        expect(painted()).toEqual([bootThemeModeFallback, PREFERENCE_DEFAULTS.themeName]);
      });

      it('leaves a supported browser\'s page to the app', () => {
        runPreflight(supportedBrowser({ localStorage: storage({ 'webatrice.themeMode': 'light' }) }));
        expect(painted()).toEqual([undefined, undefined]);
      });
    });

    it('loads an external stylesheet beside the preflight script without inline styles', () => {
      const script = document.createElement('script');
      script.src = 'https://example.test/client/preflight.js';
      runPreflight(supportedBrowser({
        WebSocket: undefined,
        document: {
          ...documentWithModules(),
          getElementById: (id: string) => document.getElementById(id),
          currentScript: script,
        },
      }));
      expect(document.head.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
        .toBe('https://example.test/client/preflight.css');
      expect(document.querySelector('style, #root [style]')).toBeNull();
    });

    it.each([
      ...Object.values(Language), 'pt-PT', 'PT-br', ' pt_pt ', 'DE-at', 'fr-CA', 'en-GB', 'unknown',
    ])('resolves %s like the app for browser and saved preferences', (language) => {
      for (const saved of [false, true]) {
        const urls: string[] = [];
        class FakeXhr {
          open(_method: string, url: string) {
            urls.push(url);
          }
          send() { /* Keep the request pending. */ }
        }
        runPreflight(supportedBrowser({
          WebSocket: undefined,
          XMLHttpRequest: FakeXhr,
          navigator: { language: saved ? 'en-US' : language },
          localStorage: { getItem: () => saved ? language : null },
        }));
        const locale = resolveSupportedLanguage(language);
        expect(urls).toEqual(locale && locale !== Language.en_US ? [`/locales/${locale}/translation.json`] : []);
      }
    });

    it('swaps in the user\'s language when its translation loads', () => {
      const requests: { url: string; respond: (status: number, body: string) => void }[] = [];
      class FakeXhr {
        status = 0;
        responseText = '';
        onload: () => void = stubFn;
        onerror: () => void = stubFn;
        private url = '';
        open(_method: string, url: string) {
          this.url = url;
        }
        send() {
          requests.push({
            url: this.url,
            respond: (status, body) => {
              this.status = status;
              this.responseText = body;
              this.onload();
            },
          });
        }
      }

      runPreflight(supportedBrowser({
        WebSocket: undefined,
        XMLHttpRequest: FakeXhr,
        navigator: { language: 'pt-BR' },
      }));

      expect(document.querySelector('h1')!.textContent).toBe(unsupportedI18n.Unsupported.title);
      expect(requests.map((request) => request.url)).toEqual(['/locales/pt_BR/translation.json']);

      requests[0].respond(200, JSON.stringify({ Unsupported: { title: 'Navegador não suportado' } }));
      expect(document.querySelector('h1')!.textContent).toBe('Navegador não suportado');
      expect(document.querySelector('li')!.textContent).toBe(browserFeatureI18n.BrowserFeature.webSocket);
      expect(document.documentElement.lang).toBe('pt-BR');
      document.documentElement.lang = 'en';
    });
  });

  it('carries exactly the English strings of the i18n sources', () => {
    const block = (name: string) => new RegExp(`${name}: \\{([\\s\\S]*?)\\n    \\}`).exec(PREFLIGHT)![1];
    const embedded = (name: string) => new Function(`return {${block(name)}};`)();

    expect(embedded('Unsupported')).toEqual(unsupportedI18n.Unsupported);
    expect(embedded('BrowserFeature')).toEqual(browserFeatureI18n.BrowserFeature);
  });
});

describe('getBrowserSupport', () => {
  afterEach(() => {
    delete window.Cockatrice;
  });

  it('reads the preflight result', () => {
    window.Cockatrice = { browserSupport: { missingRequired: [], missingOptional: ['worker'] } };
    expect(getBrowserSupport()).toEqual({ missingRequired: [], missingOptional: ['worker'] });
  });

  it('reports full support when the preflight did not run', () => {
    expect(getBrowserSupport()).toEqual({ missingRequired: [], missingOptional: [] });
  });
});
