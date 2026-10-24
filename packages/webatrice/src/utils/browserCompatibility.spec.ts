import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Browser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'ios_saf';
type BabelBrowser = Browser | 'ios';
type CompatibilityTargets = Partial<Record<BabelBrowser, string>>;
type CaniuseFeature = { stats: Record<string, Record<string, string>> };

const require = createRequire(import.meta.url);
const babelPlugins = require('@babel/compat-data/plugins') as Record<string, CompatibilityTargets>;
const caniuse = require('caniuse-lite') as {
  feature: (packed: unknown) => CaniuseFeature;
  features: Record<string, unknown>;
};

const PACKAGE_JSON = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  browserslist: { production: string[] };
};
const PREFLIGHT = readFileSync(resolve(__dirname, '../../public/preflight.js'), 'utf8');

const API_COMPATIBILITY = {
  esModules: ['es6-module'],
  bigInt: ['bigint'],
  webSocket: ['websockets'],
  cryptoRandom: ['getrandomvalues'],
  textEncoder: ['textencoder'],
  structuredClone: [],
  fetch: ['fetch', 'abortcontroller'],
  indexedDB: ['indexeddb'],
  resizeObserver: ['resizeobserver'],
} as const;

const SYNTAX_COMPATIBILITY = [
  'transform-classes',
  'transform-private-methods',
  'transform-class-properties',
  'transform-class-static-block',
  'transform-object-rest-spread',
  'transform-optional-chaining',
  'transform-nullish-coalescing-operator',
  'transform-logical-assignment-operators',
  'transform-async-generator-functions',
  'transform-optional-catch-binding',
] as const;

const STRUCTURED_CLONE_COMPATIBILITY: Record<Browser, { since: string; source: string }> = {
  chrome: { since: '98', source: 'https://developer.chrome.com/blog/new-in-chrome-98/' },
  edge: {
    since: '98',
    source: 'https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-stable-channel',
  },
  firefox: { since: '94', source: 'https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/94' },
  safari: { since: '15.4', source: 'https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/' },
  ios_saf: { since: '15.4', source: 'https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/' },
};

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function productionFloors(): Array<{ browser: Browser; version: string }> {
  return PACKAGE_JSON.browserslist.production.map((query) => {
    const match = /^(chrome|edge|firefox|safari|ios_saf) >= ([\d.]+)$/.exec(query);
    expect(match, `Unsupported production browserslist query: ${query}`).not.toBeNull();
    return { browser: match![1] as Browser, version: match![2] };
  });
}

function hasCaniuseSupport(featureName: string, browser: Browser, version: string): boolean {
  const packed = caniuse.features[featureName];
  const status = packed && caniuse.feature(packed).stats[browser]?.[version];
  return status?.split(' ')[0] === 'y';
}

function hasSyntaxSupport(plugin: string, browser: Browser, version: string): boolean {
  const babelBrowser: BabelBrowser = browser === 'ios_saf' ? 'ios' : browser;
  const supportedSince = babelPlugins[plugin]?.[babelBrowser];
  return supportedSince !== undefined && compareVersions(version, supportedSince) >= 0;
}

describe('declared browser compatibility', () => {
  const requiredChecks = [...PREFLIGHT.matchAll(/feature:\s*'([^']+)',\s*required:\s*true/g)]
    .map((match) => match[1]);

  it('has compatibility evidence for every required preflight check', () => {
    expect(requiredChecks.sort()).toEqual(['syntax', ...Object.keys(API_COMPATIBILITY)].sort());
  });

  it.each(productionFloors())('$browser $version supports every required preflight capability', ({ browser, version }) => {
    for (const [check, features] of Object.entries(API_COMPATIBILITY)) {
      const supported = check === 'structuredClone'
        ? compareVersions(version, STRUCTURED_CLONE_COMPATIBILITY[browser].since) >= 0
        : features.every((featureName) => hasCaniuseSupport(featureName, browser, version));
      expect(supported, `${browser} ${version}: ${check}`).toBe(true);
    }

    for (const plugin of SYNTAX_COMPATIBILITY) {
      expect(hasSyntaxSupport(plugin, browser, version), `${browser} ${version}: ${plugin}`).toBe(true);
    }
  });

  it('records primary browser sources for structuredClone support', () => {
    for (const { source } of Object.values(STRUCTURED_CLONE_COMPATIBILITY)) {
      expect(source).toMatch(/^https:\/\/(developer\.chrome\.com|learn\.microsoft\.com|developer\.mozilla\.org|webkit\.org)\//);
    }
  });
});
