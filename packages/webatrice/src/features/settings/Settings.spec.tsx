import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import { getPreferencesSnapshot, getSettings, settingsStore } from '../../hooks/useSettings';
import { shortcuts } from '../../store';
import { DEFAULT_PLAYMAT_SETTINGS, setPlaymatSettings } from '@app/hooks';
import { soundEngine } from '../../services';
import Settings from './Settings';

const renderSettings = async () => {
  const result = renderWithProviders(<Settings />, { preloadedState: connectedState });
  await act(async () => {
    await getSettings();
  });
  return result;
};

const nav = () => screen.getByRole('navigation', { name: 'Settings.jumpTo' });
const section = (name: RegExp) => screen.getByRole('region', { name });

const search = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Settings.searchLabel' }), { target: { value } });
};

async function confirmRestore(button: HTMLElement) {
  fireEvent.click(button);
  await act(async () => {
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Settings\.restoreDefaults$/ }));
  });
}

describe('Settings', () => {
  beforeEach(() => {
    settingsStore.reset();
  });

  it('lists the sections in desktop order beside one page that holds them all', async () => {
    await renderSettings();

    const items = within(nav()).getAllByRole('button').filter((b) => /Settings\.section\./.test(b.textContent ?? ''));
    expect(items.map((item) => item.textContent?.replace(/\d+$/, ''))).toEqual([
      'Settings.section.general',
      'Settings.section.appearance',
      'Settings.section.userInterface',
      'Settings.section.cardSources',
      'Settings.section.storage',
      'Settings.section.chat',
      'Settings.section.sound',
      'Settings.section.shortcuts',
    ]);
    expect(items[0]).toHaveAttribute('aria-current', 'location');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Settings.section.general',
      'Settings.section.appearance',
      'Settings.section.userInterface',
      'Settings.section.cardSources',
      'Settings.section.storage',
      'Settings.section.chat',
      'Settings.section.sound',
      'Settings.section.shortcuts',
    ]);
  });

  it('shows the groups of the section it is in and moves there when a section is picked', async () => {
    await renderSettings();

    expect(within(nav()).getByRole('button', { name: 'SettingsGeneral.group.startup' })).toBeInTheDocument();
    fireEvent.click(within(nav()).getByRole('button', { name: /Settings\.section\.sound/ }));

    expect(within(nav()).getByRole('button', { name: /Settings\.section\.sound/ })).toHaveAttribute('aria-current', 'location');
    expect(within(nav()).queryByRole('button', { name: 'SettingsGeneral.group.startup' })).not.toBeInTheDocument();
  });

  it('moves focus to the heading it jumps to', async () => {
    await renderSettings();
    fireEvent.click(within(nav()).getByRole('button', { name: /Settings\.section\.chat/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Settings.section.chat' })).toHaveFocus();

    fireEvent.click(within(nav()).getByRole('button', { name: 'SettingsChat.group.macros' }));
    expect(screen.getByRole('heading', { level: 3, name: 'SettingsChat.group.macros' })).toHaveFocus();
  });

  it('flashes the group picked from the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderSettings();
    fireEvent.click(within(nav()).getByRole('button', { name: /Settings\.section\.appearance/ }));
    fireEvent.click(within(nav()).getByRole('button', { name: 'SettingsAppearance.group.cardCounters' }));

    const group = section(/SettingsAppearance\.group\.cardCounters/);
    expect(group.className).toMatch(/border-accent/);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(group.className).not.toMatch(/border-accent/);
    vi.useRealTimers();
  });

  it('focuses the search box with "/", but not while typing in a field', async () => {
    await renderSettings();
    const box = screen.getByRole('searchbox', { name: 'Settings.searchLabel' });
    const room = screen.getByRole('switch', { name: /SettingsChat\.roomHistory\.label/ });

    room.focus();
    fireEvent.keyDown(room, { key: '/' });
    expect(box).toHaveFocus();

    const macro = screen.getByRole('textbox', { name: 'SettingsChat.macros.newLabel' });
    macro.focus();
    fireEvent.keyDown(macro, { key: '/' });
    expect(macro).toHaveFocus();
  });

  it('saves a preference as soon as its control changes', async () => {
    await renderSettings();

    const toggle = screen.getByRole('switch', { name: /SettingsUserInterface\.closeEmptyCardView\.label/ });
    expect(toggle).toBeChecked();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle).not.toBeChecked();
    expect(getPreferencesSnapshot().closeEmptyCardView).toBe(false);
  });

  it('records an animation switch as a choice for every animation', async () => {
    await renderSettings();

    const tap = screen.getByRole('switch', { name: /SettingsUserInterface\.tapAnimation\.label/ });
    expect(tap).toBeChecked();
    await act(async () => {
      fireEvent.click(tap);
    });

    expect(tap).not.toBeChecked();
    expect(getPreferencesSnapshot()).toMatchObject({
      animationsChosen: true,
      tapAnimation: false,
      arrowDrawAnimation: true,
      lifeCounterAnimations: true,
      battlefieldFlash: true,
    });
  });

  it('turns every animation off and on with desktop\'s two buttons', async () => {
    await renderSettings();
    const switches = () => ['tapAnimation', 'arrowDrawAnimation', 'lifeCounterAnimations', 'battlefieldFlash']
      .map((key) => screen.getByRole('switch', { name: new RegExp(`SettingsUserInterface\\.${key}\\.label`) }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SettingsUserInterface.animations.disableAll' }));
    });
    switches().forEach((toggle) => expect(toggle).not.toBeChecked());
    expect(getPreferencesSnapshot()).toMatchObject({ animationsChosen: true, battlefieldFlash: false });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SettingsUserInterface.animations.enableAll' }));
    });
    switches().forEach((toggle) => expect(toggle).toBeChecked());
  });

  it('disables a setting while the preference it depends on is off', async () => {
    await renderSettings();

    const buddies = /SettingsUserInterface\.buddyConnectNotificationsEnabled\.label/;
    expect(screen.getByRole('switch', { name: buddies })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /SettingsUserInterface\.notificationsEnabled\.label/ }));
    });

    expect(screen.getByRole('switch', { name: buddies })).toBeDisabled();
  });

  it('keeps the volume and theme editable while sound is off, as desktop does', async () => {
    await renderSettings();

    expect(getPreferencesSnapshot().soundEnabled).toBe(false);
    expect(screen.getByLabelText(/SettingsSound\.masterVolume\.label/)).toBeEnabled();
    expect(screen.getByLabelText(/SettingsSound\.soundTheme\.label/)).toBeEnabled();
  });

  it('saves the volume once the slider is let go, and plays the test sound then', async () => {
    const test = vi.spyOn(soundEngine, 'test').mockImplementation(() => {});
    await renderSettings();
    const slider = screen.getByLabelText(/SettingsSound\.masterVolume\.label/);

    fireEvent.input(slider, { target: { value: '40' } });
    expect(slider).toHaveValue('40');
    expect(getPreferencesSnapshot().masterVolume).toBe(50);
    expect(test).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(slider, { target: { value: '30' } });
    });

    expect(getPreferencesSnapshot().masterVolume).toBe(30);
    expect(test).toHaveBeenCalledWith(expect.objectContaining({ volume: 30 }));
    test.mockRestore();
  });

  it('saves a spin box once its number is committed, kept within its range', async () => {
    await renderSettings();
    const box = screen.getByLabelText(/SettingsAppearance\.minPlayersForMultiColumnLayout\.label/);
    expect(box).toHaveValue(4);
    const commit = async (value: string) => {
      fireEvent.input(box, { target: { value } });
      await act(async () => {
        fireEvent.change(box);
      });
    };

    fireEvent.input(box, { target: { value: '6' } });
    expect(getPreferencesSnapshot().minPlayersForMultiColumnLayout).toBe(4);
    await act(async () => {
      fireEvent.change(box);
    });
    expect(getPreferencesSnapshot().minPlayersForMultiColumnLayout).toBe(6);

    await commit('1');
    expect(getPreferencesSnapshot().minPlayersForMultiColumnLayout).toBe(2);
    expect(box).toHaveValue(2);

    await commit('');
    expect(getPreferencesSnapshot().minPlayersForMultiColumnLayout).toBe(2);
    expect(box).toHaveValue(2);
  });

  it('keeps the card view\'s initial rows at most its expanded rows, as desktop\'s coupled boxes do', async () => {
    await renderSettings();
    const initial = screen.getByLabelText(/SettingsAppearance\.cardViewInitialRowsMax\.label/);
    const expanded = screen.getByLabelText(/SettingsAppearance\.cardViewExpandedRowsMax\.label/);
    const commit = async (box: HTMLElement, value: string) => {
      fireEvent.input(box, { target: { value } });
      await act(async () => {
        fireEvent.change(box);
      });
    };

    await commit(initial, '30');
    expect(getPreferencesSnapshot()).toMatchObject({ cardViewInitialRowsMax: 30, cardViewExpandedRowsMax: 30 });
    expect(expanded).toHaveValue(30);

    await commit(expanded, '10');
    expect(getPreferencesSnapshot()).toMatchObject({ cardViewInitialRowsMax: 10, cardViewExpandedRowsMax: 10 });

    await commit(expanded, '25');
    expect(getPreferencesSnapshot()).toMatchObject({ cardViewInitialRowsMax: 10, cardViewExpandedRowsMax: 25 });
  });

  it('stores colors as desktop does, as hex without the hash, and shows the hex beside the swatch', async () => {
    await renderSettings();

    const color = screen.getByLabelText(/SettingsChat\.chatMentionColor\.label/);
    expect(color).toHaveValue('#a6120d');
    expect(color.parentElement).toHaveTextContent('#A6120D');

    await act(async () => {
      fireEvent.change(color, { target: { value: '#00ff88' } });
    });
    expect(getPreferencesSnapshot().chatMentionColor).toBe('00FF88');
    expect(color.parentElement).toHaveTextContent('#00FF88');
  });

  it('offers every shipped sound theme', async () => {
    await renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /SettingsSound\.soundEnabled\.label/ }));
    });

    const select = screen.getByLabelText(/SettingsSound\.soundTheme\.label/);
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Default', 'Legacy']);

    await act(async () => {
      fireEvent.change(select, { target: { value: 'Legacy' } });
    });
    expect(getPreferencesSnapshot().soundTheme).toBe('Legacy');
  });

  it('restores one section to its defaults once confirmed, naming the section', async () => {
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /SettingsChat\.roomHistory\.label/ }));
      fireEvent.click(screen.getByRole('switch', { name: /SettingsUserInterface\.closeEmptyCardView\.label/ }));
    });
    expect(getPreferencesSnapshot()).toMatchObject({ roomHistory: false, closeEmptyCardView: false });

    const restore = within(section(/^Settings\.section\.chat$/)).getAllByRole('button', { name: 'Settings.restoreSection' })[0];
    fireEvent.click(restore);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Settings.restoreDefaultsConfirm.title');
    fireEvent.click(within(dialog).getByRole('button', { name: /Settings\.restoreDefaultsConfirm\.cancel/ }));
    expect(getPreferencesSnapshot().roomHistory).toBe(false);

    await confirmRestore(restore);
    expect(getPreferencesSnapshot()).toMatchObject({ roomHistory: true, closeEmptyCardView: false });
  });

  it('restores every section at once from the header', async () => {
    await renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /SettingsChat\.roomHistory\.label/ }));
      fireEvent.click(screen.getByRole('switch', { name: /SettingsUserInterface\.closeEmptyCardView\.label/ }));
    });

    await confirmRestore(screen.getByRole('button', { name: 'Settings.restoreAll' }));
    expect(getPreferencesSnapshot()).toMatchObject({ roomHistory: true, closeEmptyCardView: true });
  });

  it('picks the theme from three tiles and the language from General', async () => {
    await renderSettings();

    const light = screen.getByRole('radio', { name: /SettingsAppearance\.themeMode\.light/ });
    expect(screen.getByRole('radiogroup', { name: /SettingsAppearance\.themeMode\.label/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /SettingsAppearance\.themeMode\.system/ })).toBeChecked();
    await act(async () => {
      fireEvent.click(light);
    });
    expect(getPreferencesSnapshot().themeMode).toBe('light');
    expect(light).toBeChecked();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/SettingsGeneral\.language\.label/), { target: { value: 'de' } });
    });
    expect(getPreferencesSnapshot().language).toBe('de');
  });

  it('edits the picture download URLs on the Card Sources section, outside "Restore defaults"', async () => {
    await renderSettings();

    const cardSources = section(/^Settings\.section\.cardSources$/);
    expect(within(cardSources).getByText('SettingsCardSources.group.downloads')).toBeInTheDocument();
    const editor = within(cardSources).getByRole('group', { name: /SettingsCardSources\.pictureUrls\.label/ });
    expect(editor).toHaveAccessibleDescription(/SettingsCardSources\.pictureUrls\.description/);
    expect(within(editor).getByRole('listbox', { name: /CardSourcesSettings\.label\.list/ })).toBeInTheDocument();
    expect(within(cardSources).queryByRole('button', { name: 'Settings.restoreSection' })).not.toBeInTheDocument();
  });

  it('lays out the Appearance section in desktop\'s group order', async () => {
    await renderSettings();

    const groups = within(section(/^Settings\.section\.appearance$/)).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual([
      'SettingsAppearance.group.theme',
      'PlaymatSettings.title',
      'SettingsAppearance.group.zoneBackgrounds',
      'SettingsAppearance.group.menus',
      'SettingsAppearance.group.cardPrintings',
      'SettingsAppearance.group.cardRendering',
      'SettingsAppearance.group.cardLayout',
      'SettingsAppearance.group.cardCounters',
      'SettingsAppearance.group.handLayout',
      'SettingsAppearance.group.tableGrid',
      'SettingsAppearance.group.signIn',
    ]);
  });

  it('shows the playmat settings as rows of the Appearance section', async () => {
    await renderSettings();

    const playmats = section(/^PlaymatSettings\.title$/);
    expect(within(playmats).getByRole('combobox', { name: /PlaymatSettings\.visibility\.label/ }))
      .toHaveAccessibleDescription('PlaymatSettings.serverNote');
    expect(within(playmats).getByRole('combobox', { name: /PlaymatSettings\.mode\.label/ })).toBeInTheDocument();
    expect(within(playmats).getByRole('group', { name: /PlaymatSettings\.collection\.title/ })).toBeInTheDocument();
    expect(within(playmats).getByRole('combobox', { name: /PlaymatSettings\.collection\.listMode/ })).toBeInTheDocument();
  });

  it('finds the picture download URLs by search', async () => {
    await renderSettings();
    search('pictureUrls');

    expect(screen.getByRole('group', { name: /SettingsCardSources\.pictureUrls\.label/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Settings\.section\.chat$/ })).not.toBeInTheDocument();
  });

  it('filters the page in place, highlights matches and counts them in the list', async () => {
    await renderSettings();

    search('roomHistory');

    expect(screen.getByRole('switch', { name: /SettingsChat\.roomHistory\.label/ })).toBeInTheDocument();
    expect(screen.queryByText(/SettingsAppearance\.group\.tableGrid/)).not.toBeInTheDocument();
    expect(screen.getByText('Settings.matchCount')).toBeInTheDocument();
    expect(document.querySelector('mark')).toHaveTextContent('roomHistory');
    const chat = within(nav()).getByRole('button', { name: /Settings\.section\.chat/ });
    expect(chat).toHaveTextContent(/1$/);
    expect(within(nav()).getByRole('button', { name: /Settings\.section\.sound/ })).toBeDisabled();
    expect(within(nav()).getAllByRole('button').every((b) => !b.hasAttribute('aria-current'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Settings.clearSearch' }));
    expect(screen.getByRole('region', { name: /^Settings\.section\.sound$/ })).toBeInTheDocument();
  });

  it('says so when nothing matches, and Escape clears the search', async () => {
    await renderSettings();
    search('___nothing___');
    expect(screen.getByText('Settings.noResults')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByText('Settings.noResults')).not.toBeInTheDocument();
  });

  it('lists matching shortcuts with their keys and a link to the Shortcuts page', async () => {
    const { store } = await renderSettings();
    act(() => {
      store.dispatch(shortcuts.Actions.setOverride({ actionId: 'deck.save', sequences: ['Ctrl+Shift+KeyS'] }));
    });
    search('deck.save');

    const list = screen.getByRole('list', { name: 'Settings.shortcuts.matches' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('ShortcutsTab.action.deck.save');
    expect(within(list).getByText('Ctrl+Shift+S')).toBeInTheDocument();
    expect(within(nav()).getByRole('button', { name: /Settings\.section\.shortcuts/ })).toHaveTextContent(/1$/);
    expect(screen.queryByText('Settings.noResults')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings.shortcuts.open' })).toBeInTheDocument();
  });

  it('keeps the Shortcuts section and its link when the search names the section', async () => {
    await renderSettings();
    search('section.shortcuts');

    expect(screen.getByRole('region', { name: /^Settings\.section\.shortcuts$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings.shortcuts.open' })).toBeInTheDocument();
    expect(within(nav()).getByRole('button', { name: /Settings\.section\.shortcuts/ })).toBeEnabled();
    expect(screen.queryByText('Settings.noResults')).not.toBeInTheDocument();
  });

  it('keeps shortcut overrides in the shortcuts slice', async () => {
    const { store } = await renderSettings();

    act(() => {
      store.dispatch(shortcuts.Actions.setOverride({ actionId: 'game.drawCard', sequences: ['Ctrl+KeyZ'] }));
    });
    expect(store.getState().shortcuts.overrides['game.drawCard']).toEqual(['Ctrl+KeyZ']);

    act(() => {
      store.dispatch(shortcuts.Actions.resetAll());
    });
    await waitFor(() => expect(store.getState().shortcuts.overrides).toEqual({}));
  });
});

it('restores the playmat preferences and collection from Appearance', async () => {
  await renderSettings();
  await act(async () => {
    await setPlaymatSettings({ visibility: 0, mode: 2, fallbackBehavior: 1,
      fallbackList: [{ cardName: 'Island', cardProviderId: '', params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 } }] });
  });
  const appearance = section(/^Settings\.section\.appearance$/);
  await confirmRestore(within(appearance).getAllByRole('button', { name: 'Settings.restoreSection' })[0]);
  expect(getPreferencesSnapshot().playmatSettings).toEqual(DEFAULT_PLAYMAT_SETTINGS);
});
