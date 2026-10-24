
import { act, fireEvent, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { lookupCard, lookupCards } from '../../services/cards/catalog/lookup';
import { buildSeatGameState, cardEl, chooseMenuPath, openContextMenu, type SeatGameSpec } from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

const BOLT = makeCard({ id: 10, name: 'Lightning Bolt', x: 0, y: 0, pt: '3/1' });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    { playerId: 1, table: [BOLT], deckCount: 40 },
    { playerId: 2, deckCount: 40 },
  ],
};

function previewImages(): HTMLImageElement[] {
  return Array.from(screen.getByTestId('card-preview-pane').querySelectorAll('img'));
}

describe('Game card preview', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a hovered seat card in the right-rail preview', () => {
    renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient: createMockWebClient() });
    expect(previewImages()).toHaveLength(0);

    const face = cardEl(BOLT.id, 'battlefield').querySelector('[title="Lightning Bolt"]');
    expect(face).not.toBeNull();
    fireEvent.mouseEnter(face!);

    expect(previewImages().map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining(`exact=${encodeURIComponent('Lightning Bolt')}`),
    ]);
  });

  it('holds the middle-click zoom open until the middle button is released', () => {
    renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient: createMockWebClient() });
    const face = cardEl(BOLT.id, 'battlefield').querySelector('[title="Lightning Bolt"]')!;
    const zoomed = () => document.querySelector('.z-\\[1400\\]');

    act(() => {
      fireEvent.mouseDown(face, { button: 1 });
    });
    expect(zoomed()).not.toBeNull();
    expect(zoomed()).toHaveTextContent('Lightning Bolt');

    act(() => {
      fireEvent.mouseUp(window, { button: 0 });
    });
    expect(zoomed()).not.toBeNull();

    act(() => {
      fireEvent.mouseUp(window, { button: 1 });
    });
    expect(zoomed()).toBeNull();
  });

  it('closes the zoom with the game', () => {
    const { unmount } = renderWithProviders(<Game />, {
      preloadedState: buildSeatGameState(SPEC),
      webClient: createMockWebClient(),
    });
    act(() => {
      fireEvent.mouseDown(cardEl(BOLT.id, 'battlefield').querySelector('[title="Lightning Bolt"]')!, { button: 1 });
    });
    expect(document.querySelector('.z-\\[1400\\]')).not.toBeNull();

    unmount();
    expect(document.querySelector('.z-\\[1400\\]')).toBeNull();
  });
  it('"View related cards" shows the relation in the preview and sends nothing', async () => {
    vi.mocked(lookupCard).mockImplementation(async (name: string) => ({
      found: true,
      source: 'dexie',
      name,
      printings: [],
      related: name === 'Lightning Bolt'
        ? [
          { name: 'Spark Elemental', origin: 'related' },
          { name: 'Missing Card', origin: 'reverse-related' },
        ]
        : undefined,
    }));
    vi.mocked(lookupCards).mockImplementation(async (inputs) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, { found: name === 'Spark Elemental', source: 'dexie', name, printings: [] }];
      })));
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient });
    await act(async () => {});

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('View related cards', 'Spark Elemental');

    expect(previewImages().map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining(`exact=${encodeURIComponent('Spark Elemental')}`),
    ]);
    for (const send of Object.values(webClient.request.game)) {
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('offers "View related cards" for an opponent\'s stack card', async () => {
    vi.mocked(lookupCard).mockImplementation(async (name: string) => ({
      found: true,
      source: 'dexie',
      name,
      printings: [],
      related: name === 'Lightning Bolt' ? [{ name: 'Spark Elemental', origin: 'related' }] : undefined,
    }));
    vi.mocked(lookupCards).mockImplementation(async (inputs) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, { found: name === 'Spark Elemental', source: 'dexie', name, printings: [] }];
      })));
    const theirBolt = makeCard({ id: 51, name: 'Lightning Bolt' });
    renderWithProviders(<Game />, {
      preloadedState: buildSeatGameState({
        localPlayerId: 1,
        seats: [{ playerId: 1, deckCount: 40 }, { playerId: 2, stack: [theirBolt], deckCount: 40 }],
      }),
      webClient: createMockWebClient(),
    });
    await act(async () => {});

    openContextMenu(cardEl(theirBolt.id, 'stack'));
    chooseMenuPath('View related cards', 'Spark Elemental');

    expect(previewImages().map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining(`exact=${encodeURIComponent('Spark Elemental')}`),
    ]);
  });
});
