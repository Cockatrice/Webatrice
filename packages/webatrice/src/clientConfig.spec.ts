import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CLIENT_CONFIG, CLIENT_VERSION, formatClientVersion } from './clientConfig';

const packageVersion: string = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
).version;

describe('clientConfig', () => {
  it('formats clientver like desktop VERSION_STRING, prefixed with the client family', () => {
    expect(formatClientVersion('5.3.0', '2026-10-03')).toBe('webatrice-5.3.0 (2026-10-03)');
  });

  it('keeps the empty commit-date fallback desktop uses outside a git checkout', () => {
    expect(formatClientVersion('5.3.0', '')).toBe('webatrice-5.3.0 ()');
  });

  it('sends the real package version and build date, not a hard-coded string', () => {
    expect(CLIENT_VERSION).toMatch(new RegExp(`^webatrice-${packageVersion.replace(/\./g, '\\.')} \\((\\d{4}-\\d{2}-\\d{2})?\\)$`));
    expect(CLIENT_CONFIG.clientver).toBe(CLIENT_VERSION);
  });
});
