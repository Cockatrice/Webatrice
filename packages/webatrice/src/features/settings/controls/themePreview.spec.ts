import { PALETTES } from '@app/services';
import { ThemeName } from '@app/types';

import { hexToTriplet, previewVars } from './themePreview';

describe('themePreview', () => {
  it('turns a hex colour into the space-separated RGB triplet the tokens use', () => {
    expect(hexToTriplet('#14101F')).toBe('20 16 31');
    expect(hexToTriplet('fff')).toBe('255 255 255');
  });

  it.each(Object.values(ThemeName))('scopes the real %s palettes as token custom properties', (name) => {
    const dark = previewVars(name, 'dark') as Record<string, string>;
    const light = previewVars(name, 'light') as Record<string, string>;
    expect(dark['--bg-base']).toBe(hexToTriplet(PALETTES[name].dark['bg-base']));
    expect(light['--bg-base']).toBe(hexToTriplet(PALETTES[name].light['bg-base']));
    expect(light['--accent-primary']).toBe(hexToTriplet(PALETTES[name].light['accent-primary']));
    expect(Object.keys(dark)).toEqual(expect.arrayContaining(['--bg-surface', '--border-subtle', '--text-muted']));
  });
});
