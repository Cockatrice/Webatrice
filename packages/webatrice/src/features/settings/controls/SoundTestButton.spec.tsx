import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../hooks/useSettings');
const { soundEngine } = vi.hoisted(() => ({ soundEngine: { test: vi.fn() } }));
vi.mock('@app/services', () => ({ soundEngine }));

import { PREFERENCE_DEFAULTS } from '@app/types';
import { usePreferences } from '../../../hooks/useSettings';
import SoundTestButton from './SoundTestButton';

describe('SoundTestButton', () => {
  it('is disabled while sound is off', () => {
    render(<SoundTestButton id="s" labelId="s-label" disabled={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('plays the test sound with the current theme and volume', () => {
    vi.mocked(usePreferences).mockReturnValue({
      ...PREFERENCE_DEFAULTS,
      soundEnabled: true,
      soundTheme: 'Legacy',
      masterVolume: 30,
    });
    render(<SoundTestButton id="s" labelId="s-label" disabled={false} />);

    fireEvent.click(screen.getByRole('button'));

    expect(soundEngine.test).toHaveBeenCalledWith({ enabled: true, theme: 'Legacy', volume: 30 });
  });
});
