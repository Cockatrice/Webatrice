import { create } from '@bufbuild/protobuf';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { ServerInfo_PlayerProperties_PlaymatParamsSchema } from '@cockatrice/sockatrice/generated';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { connectedState, renderWithProviders } from '../../../../__test-utils__';
import { PlaymatVisibility, setPlaymatSettings, DEFAULT_PLAYMAT_SETTINGS, settingsStore, cardDataPreferencesStore } from '@app/hooks';

import { CardDTO, SettingDTO } from '@app/services';

import PlayerPlaymat from './PlayerPlaymat';

const ISLAND_ID = '0e3a9b16-4e6d-4c3e-9b1a-6f0f8f1d2c3b';
const island = create(ServerInfo_PlayerProperties_PlaymatParamsSchema, {
  cardName: 'Island',
  cardProviderId: ISLAND_ID,
  marginPctL: 0,
  marginPctR: 0,
  verticalOffset: 0,
  zoom: 1,
});

function render({ version = '3.1.0 ()', withPlaymat = true, isSelf = true } = {}) {
  const playmatParams = withPlaymat ? island : undefined;
  const player = makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, playmatParams }) });
  return renderWithProviders(
    <div style={{ position: 'relative' }}>
      <PlayerPlaymat playerId={2} isSelf={isSelf} />
    </div>,
    {
      preloadedState: {
        ...connectedState,
        server: { ...(connectedState.server as any), info: { message: null, name: 'Servatrice', version } },
        games: { games: { 1: makeGameEntry({ players: { 2: player } }) } } as any,
      },
    },
  );
}

const image = () => screen.getByTestId('player-playmat').querySelector('img')!;

describe('PlayerPlaymat', () => {
  beforeEach(async () => {
    await settingsStore.whenReady();
    settingsStore.setValue(new SettingDTO('*app'));
    await cardDataPreferencesStore.whenReady();
    cardDataPreferencesStore.setValue({ pictureUrlTemplates: [], setPreferences: new Map(), setLongNames: new Map() });
    vi.spyOn(CardDTO, 'get').mockResolvedValue(undefined);
  });
  afterEach(() => {
    setPlaymatSettings(DEFAULT_PLAYMAT_SETTINGS);
    vi.restoreAllMocks();
  });

  it('loads the art crop of the announced printing, hidden until it can be cropped', async () => {
    render();
    await waitFor(() => expect(image()).not.toBeNull());
    expect(image()).toHaveAttribute('src', expect.stringContaining(`/cards/${ISLAND_ID}?format=image&version=art_crop`));
    expect(image().style.visibility).toBe('hidden');
  });

  it('cover-fits the crop over the area once the art\'s natural size is known', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    render();
    await waitFor(() => expect(image()).not.toBeNull());
    Object.defineProperty(image(), 'naturalWidth', { value: 600 });
    Object.defineProperty(image(), 'naturalHeight', { value: 400 });
    fireEvent.load(image());

    expect(image().style).toMatchObject({ left: '0px', top: '0px', width: '1000px' });
    expect(parseFloat(image().style.height)).toBeCloseTo(400 * 1000 / 600);
  });

  it('renders nothing without a playmat', () => {
    render({ withPlaymat: false });
    expect(screen.queryByTestId('player-playmat')).not.toBeInTheDocument();
  });

  it('renders nothing on a server without playmats', () => {
    render({ version: '3.0.0 ()' });
    expect(screen.queryByTestId('player-playmat')).not.toBeInTheDocument();
  });

  it('hides every playmat when playmats are turned off', () => {
    setPlaymatSettings({ visibility: PlaymatVisibility.NONE });
    render();
    expect(screen.queryByTestId('player-playmat')).not.toBeInTheDocument();
  });

  it('shows only the local player\'s playmat in own-only mode', () => {
    setPlaymatSettings({ visibility: PlaymatVisibility.OWN_ONLY });
    const { unmount } = render({ isSelf: false });
    expect(screen.queryByTestId('player-playmat')).not.toBeInTheDocument();
    unmount();

    render({ isSelf: true });
    expect(screen.getByTestId('player-playmat')).toBeInTheDocument();
  });
});

it('uses configured image sources and retries them on the battlefield', async () => {
  await settingsStore.whenReady();
  settingsStore.setValue(new SettingDTO('*app'));
  await cardDataPreferencesStore.whenReady();
  cardDataPreferencesStore.setValue({ pictureUrlTemplates: ['https://images.test/!name!.jpg'],
    setPreferences: new Map(), setLongNames: new Map() });
  vi.spyOn(CardDTO, 'get').mockResolvedValue(undefined);
  render();
  await waitFor(() => expect(image().src).toContain(`/cards/${ISLAND_ID}?format=image&version=art_crop`));
  fireEvent.error(image());
  expect(image().src).toContain('/cards/named?exact=Island&format=image&version=art_crop');
  fireEvent.error(image());
  expect(image()).toHaveAttribute('src', 'https://images.test/Island.jpg');
  fireEvent.error(image());
  expect(image().src).toContain(`/cards/${ISLAND_ID}?format=image&version=large`);
});
