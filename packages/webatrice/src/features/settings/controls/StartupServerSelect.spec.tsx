import { act, fireEvent, render, screen } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ useKnownHosts: vi.fn() }));
vi.mock('@app/feature-widgets/known-hosts', () => ({ useKnownHosts: hoisted.useKnownHosts }));

import { getPreferencesSnapshot, getSettings, settingsStore } from '../../../hooks/useSettings';
import { makeHost, makeKnownHostsHook } from '../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';
import StartupServerSelect from './StartupServerSelect';

const chickatrice = makeHost({ id: 1, name: 'Chickatrice', host: 'mtg.chickatrice.net', port: '443' });
const rooster = makeHost({ id: 2, name: 'Rooster', host: 'server.cockatrice.us/servatrice', port: '4748' });

function renderSelect() {
  render(
    <>
      <span id="s-label">Server</span>
      <StartupServerSelect id="s" labelId="s-label" disabled={false} />
    </>,
  );
  return screen.getByRole('combobox', { name: 'Server' });
}

describe('StartupServerSelect', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    settingsStore.reset();
    await getSettings();
    hoisted.useKnownHosts.mockReturnValue(
      makeKnownHostsHook({ value: { hosts: [chickatrice, rooster], selectedHost: chickatrice } }),
    );
  });

  it('offers any server, then the login form\'s known hosts', () => {
    const select = renderSelect();

    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.textContent))
      .toEqual(['SettingsGeneral.startupServer.any', 'Chickatrice', 'Rooster']);
    expect(select).toHaveValue('');
  });

  it('saves the chosen server by its address', async () => {
    const select = renderSelect();

    await act(async () => {
      fireEvent.change(select, { target: { value: 'server.cockatrice.us/servatrice:4748' } });
    });

    expect(getPreferencesSnapshot().startupServer).toBe('server.cockatrice.us/servatrice:4748');
  });

  it('keeps showing a saved server that has since been removed', async () => {
    await act(async () => {
      const settings = await getSettings();
      settings.startupServer = 'gone.example:4747';
      settingsStore.setValue(settings);
    });

    const select = renderSelect();

    expect(select).toHaveValue('gone.example:4747');
    expect(screen.getByRole('option', { name: 'gone.example:4747' })).toBeInTheDocument();
  });

  it('lists two known hosts with the same address once', () => {
    const duplicate = makeHost({ id: 3, name: 'Chickatrice again', host: 'mtg.chickatrice.net', port: '443' });
    hoisted.useKnownHosts.mockReturnValue(
      makeKnownHostsHook({ value: { hosts: [chickatrice, duplicate, rooster], selectedHost: chickatrice } }),
    );

    const select = renderSelect();

    const values = Array.from(select.querySelectorAll('option')).map((option) => option.value);
    expect(values).toEqual(['', 'mtg.chickatrice.net:443', 'server.cockatrice.us/servatrice:4748']);
  });
});
