import { act, fireEvent, render, screen } from '@testing-library/react';

import { getPreferencesSnapshot, getSettings, settingsStore } from '../../../hooks/useSettings';
import HighlightWordsField from './HighlightWordsField';

describe('HighlightWordsField', () => {
  beforeEach(async () => {
    settingsStore.reset();
    await getSettings();
  });

  it('saves the words as they are typed', async () => {
    render(<HighlightWordsField id="w" labelId="w-label" disabled={false} />);

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'commander edh' } });
    });

    expect(getPreferencesSnapshot().chatHighlightWords).toBe('commander edh');
  });

  it('saves words with punctuation too, as desktop has no validator', async () => {
    render(<HighlightWordsField id="w" labelId="w-label" disabled={false} />);

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gg!' } });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getPreferencesSnapshot().chatHighlightWords).toBe('gg!');
  });

  it('follows a change made elsewhere, such as Restore defaults', async () => {
    render(<HighlightWordsField id="w" labelId="w-label" disabled={false} />);

    await act(async () => {
      const settings = await getSettings();
      settings.chatHighlightWords = 'modern';
      settingsStore.setValue(settings);
    });

    expect(screen.getByRole('textbox')).toHaveValue('modern');
  });
});
