import { act, fireEvent, render, screen } from '@testing-library/react';

import { getPreferencesSnapshot, getSettings, settingsStore } from '../../hooks/useSettings';
import { StartupTab } from '@app/types';
import SettingRow from './SettingRow';
import type { SettingEntry } from './registry';

const bufferEntry: SettingEntry = {
  id: 'buffer',
  labelKey: 'buffer.label',
  control: { kind: 'number', key: 'replayRewindBufferingMs', min: 0, max: 9999, unitKey: 'buffer.unit' },
};

const roomEntry: SettingEntry = {
  id: 'room',
  labelKey: 'room.label',
  control: { kind: 'text', key: 'startupRoom', placeholderKey: 'room.placeholder' },
  visibleWhen: ({ startupTab }) => startupTab === StartupTab.ServerRoom,
};

async function commit(input: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
}

async function setStartupTab(startupTab: StartupTab) {
  await act(async () => {
    const settings = await getSettings();
    settings.startupTab = startupTab;
    settingsStore.setValue(settings);
  });
}

describe('SettingRow', () => {
  beforeEach(async () => {
    settingsStore.reset();
    await getSettings();
  });

  describe('number control', () => {
    it('saves a whole number and names its unit', async () => {
      render(<SettingRow entry={bufferEntry} />);
      const input = screen.getByRole('spinbutton', { name: 'buffer.label' });
      expect(input).toHaveAccessibleDescription('buffer.unit');

      await commit(input, '350');

      expect(getPreferencesSnapshot().replayRewindBufferingMs).toBe(350);
    });

    it('keeps the value within its range, rounded, as a spin box does', async () => {
      render(<SettingRow entry={bufferEntry} />);
      const input = screen.getByRole('spinbutton');

      await commit(input, '12000');
      expect(getPreferencesSnapshot().replayRewindBufferingMs).toBe(9999);
      expect(input).toHaveValue(9999);

      await commit(input, '-5');
      expect(getPreferencesSnapshot().replayRewindBufferingMs).toBe(0);

      await commit(input, '20.6');
      expect(getPreferencesSnapshot().replayRewindBufferingMs).toBe(21);
    });

    it('goes back to the saved value when emptied', async () => {
      render(<SettingRow entry={bufferEntry} />);
      const input = screen.getByRole('spinbutton');

      await commit(input, '');

      expect(getPreferencesSnapshot().replayRewindBufferingMs).toBe(200);
      expect(input).toHaveValue(200);
    });
  });

  describe('text control and visibleWhen', () => {
    it('is hidden while its condition does not hold, as desktop hides the startup room', () => {
      const { container } = render(<SettingRow entry={roomEntry} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('saves the text trimmed once committed', async () => {
      await setStartupTab(StartupTab.ServerRoom);
      render(<SettingRow entry={roomEntry} />);
      const input = screen.getByRole('textbox', { name: 'room.label' });
      expect(input).toHaveAttribute('placeholder', 'room.placeholder');

      await commit(input, '  Magic  ');

      expect(getPreferencesSnapshot().startupRoom).toBe('Magic');
      expect(input).toHaveValue('Magic');
    });
  });
});
