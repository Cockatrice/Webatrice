import { act, fireEvent, render, screen } from '@testing-library/react';

import { getPreferencesSnapshot, getSettings, settingsStore } from '../../../hooks/useSettings';
import MessageMacrosEditor from './MessageMacrosEditor';

const renderEditor = async (macros: string[] = []) => {
  const settings = await getSettings();
  settings.messageMacros = macros;
  settingsStore.setValue(settings);
  render(<MessageMacrosEditor id="m" labelId="m-label" disabled={false} />);
};

const typeAndSubmit = async (input: HTMLElement, value: string, button: RegExp) => {
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: button }));
  });
};

describe('MessageMacrosEditor', () => {
  beforeEach(() => {
    settingsStore.reset();
  });

  it('adds a message to the end of the list', async () => {
    await renderEditor(['gg']);

    await typeAndSubmit(screen.getByLabelText(/SettingsChat\.macros\.newLabel/), '  glhf  ', /SettingsChat\.macros\.add/);

    expect(getPreferencesSnapshot().messageMacros).toEqual(['gg', 'glhf']);
    expect(screen.getByText('glhf')).toBeInTheDocument();
    expect(screen.getByLabelText(/SettingsChat\.macros\.newLabel/)).toHaveValue('');
  });

  it('rejects an empty message', async () => {
    await renderEditor();

    await typeAndSubmit(screen.getByLabelText(/SettingsChat\.macros\.newLabel/), '   ', /SettingsChat\.macros\.add/);

    expect(getPreferencesSnapshot().messageMacros).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Common.validation.required');
  });

  it('edits a message in place, keeping its position', async () => {
    await renderEditor(['one', 'two', 'three']);

    fireEvent.click(screen.getAllByRole('button', { name: /SettingsChat\.macros\.edit/ })[1]);
    await typeAndSubmit(screen.getByLabelText(/SettingsChat\.macros\.editLabel/), 'TWO', /SettingsChat\.macros\.save/);

    expect(getPreferencesSnapshot().messageMacros).toEqual(['one', 'TWO', 'three']);
  });

  it('cancels an edit with Escape', async () => {
    await renderEditor(['one']);

    fireEvent.click(screen.getByRole('button', { name: /SettingsChat\.macros\.edit/ }));
    fireEvent.keyDown(screen.getByLabelText(/SettingsChat\.macros\.editLabel/), { key: 'Escape' });

    expect(screen.queryByLabelText(/SettingsChat\.macros\.editLabel/)).not.toBeInTheDocument();
    expect(getPreferencesSnapshot().messageMacros).toEqual(['one']);
  });

  it('removes a message', async () => {
    await renderEditor(['one', 'two']);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /SettingsChat\.macros\.remove/ })[0]);
    });

    expect(getPreferencesSnapshot().messageMacros).toEqual(['two']);
  });
});
