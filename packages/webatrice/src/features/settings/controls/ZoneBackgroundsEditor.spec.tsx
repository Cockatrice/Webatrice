import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import translation from '../../../i18n-default.json';

import { renderWithProviders } from '../../../__test-utils__';
import { getPreferencesSnapshot, getSettings, settingsStore } from '../../../hooks/useSettings';
import ZoneBackgroundsEditor from './ZoneBackgroundsEditor';

const tile = (zone: string) => document.querySelector<HTMLElement>(`[data-zone-background="${zone}"]`)!;

async function renderEditor() {
  const result = renderWithProviders(<ZoneBackgroundsEditor id="zones" labelId="zones-label" disabled={false} />);
  await act(async () => {
    await getSettings();
  });
  return result;
}

describe('ZoneBackgroundsEditor', () => {
  beforeEach(() => {
    settingsStore.reset();
  });

  it('shows the hand, stack, table and player area, none with a background yet', async () => {
    await renderEditor();
    for (const zone of ['hand', 'stack', 'table', 'playerInfo']) {
      expect(tile(zone)).toHaveTextContent('SettingsAppearance.zoneBackgrounds.none');
      expect(within(tile(zone)).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' }))
        .toHaveTextContent('SettingsAppearance.zoneBackgrounds.set');
    }
    expect(screen.queryByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.clearLabel' })).not.toBeInTheDocument();
  });

  it('sets a zone\'s background to a card\'s art, cropped like a playmat, and clears it', async () => {
    await renderEditor();
    const choose = within(tile('stack')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' });
    fireEvent.click(choose);
    expect(choose).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByRole('textbox', { name: 'SettingsAppearance.zoneBackgrounds.cardName' }), {
      target: { value: '  Island ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.setLabel' }));
    });

    expect(getPreferencesSnapshot().zoneBackgrounds).toEqual({
      stack: { cardName: 'Island', cardProviderId: '', params: { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 } },
    });
    expect(tile('stack')).toHaveTextContent('Island');
    expect(within(tile('stack')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' }))
      .toHaveTextContent('SettingsAppearance.zoneBackgrounds.change');

    const edit = within(tile('stack')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.editLabel' });
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    const editor = document.getElementById(edit.getAttribute('aria-controls')!)!;
    expect(within(editor).getByRole('group', { name: 'PlaymatSettings.crop.title' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(tile('stack')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.clearLabel' }));
    });
    expect(getPreferencesSnapshot().zoneBackgrounds).toEqual({});
  });

  it('returns focus to the button that opened the form or the crop editor', async () => {
    await renderEditor();
    const choose = within(tile('table')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' });
    fireEvent.click(choose);
    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.cancel' }));
    expect(choose).toHaveFocus();

    fireEvent.click(choose);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Forest' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.setLabel' }));
    });
    expect(within(tile('table')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' })).toHaveFocus();

    const crop = within(tile('table')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.editLabel' });
    fireEvent.click(crop);
    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.done' }));
    expect(crop).toHaveFocus();
  });

  it('refuses a blank card name', async () => {
    await renderEditor();
    fireEvent.click(within(tile('hand')).getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.chooseLabel' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SettingsAppearance.zoneBackgrounds.setLabel' }));
    });
    expect(getPreferencesSnapshot().zoneBackgrounds).toEqual({});
    expect(screen.getByText('Common.validation.required')).toBeInTheDocument();
  });

  it('names each zone\'s buttons after the zone, so assistive tech can tell the tiles apart', async () => {
    const english = i18n.createInstance();
    await english.use(ICU).use(initReactI18next).init({ lng: 'en', resources: { en: { translation } } });
    settingsStore.reset();
    const settings = await getSettings();
    const island = { cardName: 'Island', cardProviderId: '', params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 } };
    settingsStore.setValue(Object.assign(settings, { zoneBackgrounds: { hand: island, table: island } }));
    render(
      <I18nextProvider i18n={english}>
        <ZoneBackgroundsEditor id="zones" labelId="zones-label" disabled={false} />
      </I18nextProvider>,
    );

    for (const name of [
      'Choose the Hand background', 'Choose the Stack background', 'Choose the Table background',
      'Choose the Player area background',
      'Edit the Hand background\'s crop', 'Clear the Hand background',
      'Edit the Table background\'s crop', 'Clear the Table background',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
