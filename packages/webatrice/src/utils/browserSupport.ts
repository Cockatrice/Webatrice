
export type BrowserFeature =
  | 'syntax'
  | 'esModules'
  | 'bigInt'
  | 'webSocket'
  | 'cryptoRandom'
  | 'textEncoder'
  | 'structuredClone'
  | 'fetch'
  | 'indexedDB'
  | 'resizeObserver'
  | 'webCrypto'
  | 'worker'
  | 'broadcastChannel'
  | 'clipboard';

export interface BrowserSupport {
  missingRequired: BrowserFeature[];
  missingOptional: BrowserFeature[];
}

export function getBrowserSupport(): BrowserSupport {
  const support = window.Cockatrice?.browserSupport;

  return {
    missingRequired: (support?.missingRequired ?? []) as BrowserFeature[],
    missingOptional: (support?.missingOptional ?? []) as BrowserFeature[],
  };
}
