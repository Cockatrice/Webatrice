const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('@app/services', () => ({ soundEngine: { play } }));
vi.mock('./useSettings');

import { PREFERENCE_DEFAULTS } from '@app/types';
import { playSound } from './playSound';
import { getPreferencesSnapshot } from './useSettings';

describe('playSound', () => {
  it('plays through the engine with the current sound preferences', () => {
    vi.mocked(getPreferencesSnapshot).mockReturnValue({
      ...PREFERENCE_DEFAULTS,
      soundEnabled: true,
      soundTheme: 'Legacy',
      masterVolume: 55,
    });

    playSound('shuffle');

    expect(play).toHaveBeenCalledWith('shuffle', { enabled: true, theme: 'Legacy', volume: 55 });
  });

  it('passes the disabled state through, so the engine stays silent', () => {
    vi.mocked(getPreferencesSnapshot).mockReturnValue(PREFERENCE_DEFAULTS);
    playSound('shuffle');
    expect(play).toHaveBeenCalledWith('shuffle', expect.objectContaining({ enabled: false }));
  });
});
