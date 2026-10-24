import { act, render, screen, waitFor } from '@testing-library/react';

import { cardDataPreferencesStore } from '@app/hooks';
import { CardDTO } from '@app/services';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import ZoneBackground from './ZoneBackground';

const island = { cardName: 'Island', cardProviderId: 'uuid-1', params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 } };

describe('ZoneBackground', () => {
  beforeEach(async () => {
    await cardDataPreferencesStore.whenReady();
    cardDataPreferencesStore.setValue({ pictureUrlTemplates: [], setPreferences: new Map(), setLongNames: new Map() });
    vi.spyOn(CardDTO, 'get').mockResolvedValue(undefined);
  });

  afterEach(() => {
    settingsStore.reset();
    vi.restoreAllMocks();
  });

  it('draws nothing for a zone without a background', () => {
    render(<ZoneBackground zone="stack" />);
    expect(screen.queryByTestId('zone-background-stack')).not.toBeInTheDocument();
  });

  it('draws the zone\'s card art under the zone\'s content', async () => {
    const settings = await getSettings();
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { zoneBackgrounds: { stack: island } }));
    });
    render(<ZoneBackground zone="stack" />);
    const background = screen.getByTestId('zone-background-stack');
    expect(background).toHaveStyle({ zIndex: '-1' });
    await waitFor(() => expect(background.querySelector('img')).not.toBeNull());
    expect(background.querySelector('img'))
      .toHaveAttribute('src', expect.stringContaining('/cards/named?exact=Island&format=image&version=art_crop'));
    expect(screen.queryByTestId('zone-background-hand')).not.toBeInTheDocument();
  });
});
