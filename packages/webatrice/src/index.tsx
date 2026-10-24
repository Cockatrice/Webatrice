import { getBrowserSupport } from './utils/browserSupport';

if (typeof performance.mark === 'function') {
  performance.mark('webatrice:boot-start');
}

if (getBrowserSupport().missingRequired.length === 0) {
  void import('./boot');
}
