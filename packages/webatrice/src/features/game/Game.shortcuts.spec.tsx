
import { act, fireEvent, screen, within } from '@testing-library/react';
import { makeArrow, makeCard } from '@cockatrice/datatrice/testing';
import { CardAttribute } from '@cockatrice/sockatrice/generated';

import { ShortcutProvider, type ActionId } from '@app/feature-widgets/shortcuts';
import { usePreferences } from '@app/hooks';
import { PREFERENCE_DEFAULTS } from '@app/types';
import { shortcuts } from '@app/store';
import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  LIFE_COUNTER_ID,
  openContextMenu,
  type SeatGameSpec,
} from './__test-utils__/seatFixtures';
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

function seatState(spec: Partial<SeatGameSpec> = {}) {
  const state = buildSeatGameState({
    localPlayerId: 1,
    seats: [
      { playerId: 1, deckCount: 40, hand: [] },
      { playerId: 2, deckCount: 40 },
    ],
    ...spec,
  });
  const players = state.games!.games![1]!.players!;
  players[1]!.arrows = { 5: makeArrow({ id: 5 }), 6: makeArrow({ id: 6 }) };
  players[2]!.arrows = { 7: makeArrow({ id: 7 }) };
  return state;
}

function renderGame(spec: Partial<SeatGameSpec> = {}) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <ShortcutProvider>
      <Game />
    </ShortcutProvider>,
    { preloadedState: seatState(spec), webClient, route: '/game/1' },
  );
  return { ...utils, game: webClient.request.game };
}

function bindKey(store: ReturnType<typeof renderGame>['store'], actionId: ActionId, sequence: string) {
  act(() => {
    store.dispatch(shortcuts.Actions.setOverride({ actionId, sequences: [sequence] }));
  });
}

function press(code: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true, ...init });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('Game seat shortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Ctrl+R deletes each of the local player\'s arrows once and keeps the page from reloading', () => {
    const { game } = renderGame();

    const event = press('KeyR', { ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(vi.mocked(game.deleteArrow).mock.calls.map(([, params]) => params)).toEqual([
      { arrowId: 5 },
      { arrowId: 6 },
    ]);
  });

  it('Ctrl+L opens the set-life prompt and Ctrl+M the choose-mulligan prompt', () => {
    renderGame();

    press('KeyL', { ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Set life total' })).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(screen.getByRole('dialog', { name: 'Set life total' }), { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Set life total' })).not.toBeInTheDocument();

    press('KeyM', { ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Draw hand' })).toBeInTheDocument();
  });

  it('on macOS Cmd answers the Ctrl bindings, as Qt maps Ctrl to Cmd', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { game } = renderGame();

    const event = press('KeyR', { metaKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(vi.mocked(game.deleteArrow).mock.calls.map(([, params]) => params)).toEqual([
      { arrowId: 5 },
      { arrowId: 6 },
    ]);

    press('KeyM', { metaKey: true });
    expect(screen.getByRole('dialog', { name: 'Draw hand' })).toBeInTheDocument();
  });

  it('off macOS Cmd+R is left to the browser', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    const { game } = renderGame();

    const event = press('KeyR', { metaKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(game.deleteArrow).not.toHaveBeenCalled();
  });

  it('a spectator has no seat to act on, so Ctrl+R stays with the browser', () => {
    const { game } = renderGame({ spectator: true, localPlayerId: 3 });

    const event = press('KeyR', { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(game.deleteArrow).not.toHaveBeenCalled();
  });

  it('a bound "Reveal selected cards to all players" reveals the hand selection in one command', () => {
    const { game, store } = renderGame({
      seats: [
        { playerId: 1, deckCount: 40, hand: [makeCard({ id: 60, name: 'Opt' }), makeCard({ id: 61, name: 'Ponder' })] },
        { playerId: 2, deckCount: 40 },
      ],
    });
    act(() => {
      store.dispatch(shortcuts.Actions.setOverride({ actionId: 'game.revealSelectedToAll', sequences: ['Alt+KeyV'] }));
    });

    press('KeyV', { altKey: true });
    expect(game.revealCards).not.toHaveBeenCalled();

    openContextMenu(cardEl(60, 'hand'));
    chooseMenuPath('Select All');
    press('KeyV', { altKey: true });

    expect(game.revealCards).toHaveBeenCalledTimes(1);
    expect(game.revealCards).toHaveBeenCalledWith(1, { zoneName: 'hand', cardId: [60, 61] });
  });

  describe('the desktop shortcut groups', () => {
    const handSeats = {
      seats: [
        { playerId: 1, deckCount: 40, hand: [makeCard({ id: 60, name: 'Opt' }), makeCard({ id: 61, name: 'Ponder' })] },
        { playerId: 2, deckCount: 40 },
      ],
    };

    it('Move selected card: Ctrl+Delete moves the hand selection to the graveyard in one command', () => {
      const { game } = renderGame(handSeats);
      openContextMenu(cardEl(60, 'hand'));
      chooseMenuPath('Select All');

      const event = press('Delete', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
      expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, expect.objectContaining({
        startZone: 'hand',
        cardsToMove: { card: [{ cardId: 60 }, { cardId: 61 }] },
        targetZone: 'grave',
      })]]);
    });

    it('Move top card: Ctrl+Shift+E plays the top card face down once', () => {
      const { game } = renderGame();
      const event = press('KeyE', { ctrlKey: true, shiftKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, expect.objectContaining({
        startZone: 'deck',
        cardsToMove: { card: [{ cardId: 0, faceDown: true }] },
        targetZone: 'table',
      })]]);
    });

    it('Move bottom card: a bound "Draw bottom card" draws the bottom card once', () => {
      const { game, store } = renderGame();
      act(() => {
        store.dispatch(shortcuts.Actions.setOverride({ actionId: 'game.drawBottomCard', sequences: ['Alt+KeyB'] }));
      });
      press('KeyB', { altKey: true });
      expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, expect.objectContaining({
        startZone: 'deck',
        cardsToMove: { card: [{ cardId: 39 }] },
        targetZone: 'hand',
      })]]);
    });

    it('Gameplay: a bound "Shuffle top cards" asks how many, then shuffles that many once', () => {
      const { game, store } = renderGame();
      bindKey(store, 'game.shuffleTopCards', 'Alt+KeyJ');
      press('KeyJ', { altKey: true });
      const dialog = screen.getByRole('dialog', { name: 'Shuffle top cards of library' });
      fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '5' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Shuffle' }));
      expect(vi.mocked(game.shuffle).mock.calls).toEqual([[1, { zoneName: 'deck', start: 0, end: 4 }]]);
    });

    const tableSeats = {
      seats: [
        {
          playerId: 1,
          deckCount: 40,
          hand: [],
          table: [makeCard({ id: 70, name: 'Bear', pt: '2/2' }), makeCard({ id: 71, name: 'Wall', pt: '0/4', tapped: true })],
        },
        { playerId: 2, deckCount: 40 },
      ],
    };
    const selectBattlefield = () => {
      openContextMenu(cardEl(70, 'battlefield'));
      chooseMenuPath('Select All');
    };
    const cardAttrs = (game: ReturnType<typeof renderGame>['game'], attribute: CardAttribute) =>
      vi.mocked(game.setCardAttr).mock.calls.map(([, p]) => p).filter((p) => p.attribute === attribute)
        .map((p) => [p.cardId, p.attrValue]);

    it('Card counters: a bound "Add counter (D)" adds one cyan counter to each selected card in one command', () => {
      const { game, store } = renderGame(tableSeats);
      bindKey(store, 'game.addCounterD', 'Alt+KeyD');
      selectBattlefield();
      press('KeyD', { altKey: true });
      expect(vi.mocked(game.bulkSetCardCounterEntries).mock.calls.map(([, entries]) => entries)).toEqual([[
        { ownerPlayerId: 1, zone: 'table', cardId: 70, counterId: 3, counterValue: 1 },
        { ownerPlayerId: 1, zone: 'table', cardId: 71, counterId: 3, counterValue: 1 },
      ]]);
    });

    it('Power and toughness: a bound "Move toughness to power" sets each selected card\'s P/T once', () => {
      const { game, store } = renderGame(tableSeats);
      bindKey(store, 'game.flowP', 'Alt+KeyF');
      selectBattlefield();
      press('KeyF', { altKey: true });
      expect(cardAttrs(game, CardAttribute.AttrPT)).toEqual([[70, '3/1'], [71, '1/3']]);
    });

    it('Playing area: a bound "Tap / Untap" flips each selected card once', () => {
      const { game, store } = renderGame(tableSeats);
      bindKey(store, 'game.tapCard', 'Alt+KeyT');
      selectBattlefield();
      press('KeyT', { altKey: true });
      expect(cardAttrs(game, CardAttribute.AttrTapped)).toEqual([[70, '1'], [71, '0']]);
    });

    it('View: a bound "View exile" opens the exile view and sends nothing', () => {
      const { game, store } = renderGame();
      bindKey(store, 'game.viewExile', 'Alt+KeyX');
      press('KeyX', { altKey: true });
      expect(screen.getByRole('dialog', { name: 'Exile — P1' })).toBeInTheDocument();
      expect(game.moveCard).not.toHaveBeenCalled();
    });

    it('Player counters: Shift+F12 / Shift+F11 add and remove one life; F12 itself stays with the browser', () => {
      const { game } = renderGame();
      const devtools = press('F12');
      press('F12', { shiftKey: true });
      press('F11', { shiftKey: true });
      expect(devtools.defaultPrevented).toBe(false);
      expect(vi.mocked(game.incCounter).mock.calls.map(([, params]) => params)).toEqual([
        { counterId: LIFE_COUNTER_ID, delta: 1 },
        { counterId: LIFE_COUNTER_ID, delta: -1 },
      ]);
    });

    it('Game phases: a bound phase key sets that phase once', () => {
      const { game, store } = renderGame();
      act(() => {
        store.dispatch(shortcuts.Actions.setOverride({ actionId: 'game.setPhase3', sequences: ['Alt+KeyP'] }));
      });
      press('KeyP', { altKey: true });
      expect(vi.mocked(game.setActivePhase).mock.calls.map(([, params]) => params)).toEqual([{ phase: 3 }]);
    });

    it('Hand: a bound "Reveal hand to all players" reveals the whole hand once; a spectator reveals nothing', () => {
      const bind = (store: ReturnType<typeof renderGame>['store']) => act(() => {
        store.dispatch(shortcuts.Actions.setOverride({ actionId: 'game.revealHandToAll', sequences: ['Alt+KeyV'] }));
      });
      const seated = renderGame(handSeats);
      bind(seated.store);
      press('KeyV', { altKey: true });
      expect(vi.mocked(seated.game.revealCards).mock.calls).toEqual([[1, { zoneName: 'hand' }]]);
      seated.unmount();

      const spectator = renderGame({ ...handSeats, localPlayerId: 3, spectator: true });
      bind(spectator.store);
      const event = press('KeyV', { altKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(spectator.game.revealCards).not.toHaveBeenCalled();
    });
  });

  const withMacros = (messageMacros: readonly string[]) =>
    vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, messageMacros });
  afterEach(() => {
    vi.mocked(usePreferences).mockImplementation(() => PREFERENCE_DEFAULTS);
  });

  it('Alt+digit sends the matching message macro verbatim, and nothing without one', () => {
    withMacros(['gg', 'Respond?']);
    const { game } = renderGame();

    press('Digit2', { altKey: true });
    press('Digit3', { altKey: true });

    expect(vi.mocked(game.gameSay).mock.calls).toEqual([[1, { message: 'Respond?' }]]);
  });

  it('a spectator has no Say macros', () => {
    withMacros(['gg']);
    const { game } = renderGame({ localPlayerId: 3, spectator: true });
    press('Digit1', { altKey: true });
    expect(game.gameSay).not.toHaveBeenCalled();
  });

  it('seats install no keydown listener of their own', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderGame();

    const keydownAdds = add.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(2);

    unmount();
    for (const [, listener] of keydownAdds) {
      expect(remove.mock.calls.some(([type, l]) => type === 'keydown' && l === listener)).toBe(true);
    }
  });
});
