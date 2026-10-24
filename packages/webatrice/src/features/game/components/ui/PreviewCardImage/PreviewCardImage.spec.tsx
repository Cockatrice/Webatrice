import { act, render, screen, waitFor } from '@testing-library/react';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import { lookupCardsCached } from '../../../../../services/cards/catalog/lookup';
import PreviewCardImage from './PreviewCardImage';

vi.mock('../../../../../services/cards/catalog/lookup', () => ({
  lookupCardsCached: vi.fn(async (names: string[]) =>
    new Map(names.map((name) => [name, { found: true, source: 'dexie', name, printings: [], landscape: name === 'Invasion of Tarkir' }]))),
}));

const sideways = () => document.querySelector('[data-sideways]');

describe('PreviewCardImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    settingsStore.reset();
  });

  it('turns a sideways-layout card a quarter so it reads upright', async () => {
    render(<PreviewCardImage src="battle.jpg" name="Invasion of Tarkir" />);
    await waitFor(() => expect(sideways()).not.toBeNull());
    expect(sideways()).toHaveStyle({ aspectRatio: '7 / 5' });
    expect(sideways()!.querySelector('img')).toHaveStyle({ transform: 'translate(-50%, -50%) rotate(90deg)' });
  });

  it('leaves a portrait card as it is', async () => {
    render(<PreviewCardImage src="bears.jpg" name="Grizzly Bears" />);
    await waitFor(() => expect(lookupCardsCached).toHaveBeenCalledWith(['Grizzly Bears'], expect.any(AbortSignal)));
    expect(sideways()).toBeNull();
    expect(screen.getByRole('presentation')).toHaveStyle({ aspectRatio: '5 / 7' });
  });

  it('never turns a card with "Auto-Rotate cards with sideways layout" off', async () => {
    const settings = await getSettings();
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { autoRotateSidewaysLayoutCards: false }));
    });
    render(<PreviewCardImage src="battle.jpg" name="Invasion of Tarkir" />);
    await act(async () => {});
    expect(sideways()).toBeNull();
    expect(lookupCardsCached).not.toHaveBeenCalled();
  });

  it('aborts the abandoned layout lookup when the card changes', () => {
    vi.mocked(lookupCardsCached).mockImplementation(() => new Promise(() => {}));
    const { rerender } = render(<PreviewCardImage src="bears.jpg" name="Grizzly Bears" />);
    const firstSignal = vi.mocked(lookupCardsCached).mock.calls[0]?.[1];

    rerender(<PreviewCardImage src="opt.jpg" name="Opt" />);

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    expect(lookupCardsCached).toHaveBeenLastCalledWith(['Opt'], expect.any(AbortSignal));
  });
});
