
import { act, fireEvent, screen, within } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { games } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { buildSeatGameState, chooseMenuPath, openContextMenu, pileEl } from './__test-utils__/seatFixtures';
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

function renderSeats({ deckCount = 5 } = {}) {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<Game />, {
    preloadedState: buildSeatGameState({
      localPlayerId: 1,
      seats: [
        { playerId: 1, hand: [], deckCount },
        { playerId: 2, handCount: 5, deckCount: 33 },
      ],
    }),
    webClient,
  });
  return { game: webClient.request.game, store };
}

type Store = ReturnType<typeof renderSeats>['store'];

function lands(store: Store, id: number, name: string) {
  act(() => {
    store.dispatch(games.Actions.zoneCardCountAdjusted({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK, delta: -1 }));
    store.dispatch(games.Actions.cardInsertedIntoZone({
      gameId: 1,
      playerId: 1,
      zoneName: ZoneName.STACK,
      card: makeCard({ id, name }),
    }));
  });
}

function openDialog(): HTMLElement {
  openContextMenu(pileEl('Library', 0));
  chooseMenuPath('Top of library...', 'Put top cards on stack until…');
  return screen.getByRole('dialog', { name: 'Put top cards on stack until…' });
}

function start(dialog: HTMLElement, { filter, hits = '1', autoPlay = false }: { filter: string; hits?: string; autoPlay?: boolean }) {
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: filter } });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: hits } });
  if (autoPlay) {
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Auto play hits' }));
  }
  act(() => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start' }));
  });
}

type GameCalls = ReturnType<typeof renderSeats>['game'];

function moves(game: GameCalls) {
  return vi.mocked(game.moveCard).mock.calls.map(([, p]) => [p.startZone, p.cardsToMove?.card?.map((c) => c.cardId), p.targetZone, p.x]);
}

const REVEAL = [ZoneName.DECK, [0], ZoneName.STACK, -1];

describe('put top cards on stack until', () => {
  it('refuses an empty filter or a hit count outside 1–99, and Esc sends nothing', () => {
    const { game } = renderSeats();
    const dialog = openDialog();
    const startButton = within(dialog).getByRole('button', { name: 'Start' });
    expect(within(dialog).getByText('Library size: 5')).toBeInTheDocument();
    expect(startButton).toBeDisabled();

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Bolt' } });
    expect(startButton).toBeEnabled();
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '0' } });
    expect(startButton).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '100' } });
    expect(startButton).toBeDisabled();

    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Put top cards on stack until…' })).not.toBeInTheDocument();
    expect(game.moveCard).not.toHaveBeenCalled();
  });

  it('reveals one card at a time until the hits are found', () => {
    const { game, store } = renderSeats();
    start(openDialog(), { filter: 'Bolt', hits: '2' });
    expect(screen.queryByRole('dialog', { name: 'Put top cards on stack until…' })).not.toBeInTheDocument();
    expect(moves(game)).toEqual([REVEAL]);

    lands(store, 100, 'Island');
    expect(moves(game)).toEqual([REVEAL, REVEAL]);
    lands(store, 101, 'Bolt');
    expect(moves(game)).toEqual([REVEAL, REVEAL, REVEAL]);
    lands(store, 102, 'Bolt');
    expect(moves(game)).toHaveLength(3);
  });

  it('sends no extra reveal when the state updates without a new stack card', () => {
    const { game, store } = renderSeats();
    start(openDialog(), { filter: 'Bolt' });

    act(() => {
      store.dispatch(games.Actions.zoneCardCountAdjusted({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK, delta: -1 }));
    });

    expect(moves(game)).toEqual([REVEAL]);
  });

  it('plays a hit to the battlefield with auto play', () => {
    const { game, store } = renderSeats();
    start(openDialog(), { filter: 'Bolt', autoPlay: true });

    lands(store, 101, 'Bolt');

    expect(moves(game)).toEqual([REVEAL, [ZoneName.STACK, [101], ZoneName.TABLE, -1]]);
  });

  it('stops when the library runs out', () => {
    const { game, store } = renderSeats({ deckCount: 1 });
    start(openDialog(), { filter: 'Bolt' });

    lands(store, 100, 'Island');

    expect(moves(game)).toEqual([REVEAL]);
  });

  it('ignores stack cards it did not reveal', () => {
    const { game, store } = renderSeats();
    act(() => {
      store.dispatch(games.Actions.cardInsertedIntoZone({
        gameId: 1, playerId: 1, zoneName: ZoneName.STACK, card: makeCard({ id: 90, name: 'Bolt' }),
      }));
    });
    start(openDialog(), { filter: 'Bolt' });

    lands(store, 100, 'Island');

    expect(moves(game)).toEqual([REVEAL, REVEAL]);
  });
});
