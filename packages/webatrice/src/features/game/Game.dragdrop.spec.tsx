// Cross-seat drag-and-drop through <Game />.
//
// Seat drags run on the game's DnD coordinator (useGameDnd with the window-level
// GamePointerSensor; seat zones hit-tested at the pointer). jsdom has no layout, so
// each test gives the zones it uses a fixed box via `layoutBoxes`; everything else
// sits off-screen.
// Single-seat destinations (piles, hand, stack, sideboard, the drag threshold) are
// pinned in PlayerBox.characterization.spec.tsx; this file covers the drags that
// cross seats: gifts onto another battlefield, lent-library drags carrying the
// lender's id, and what an opponent's card does when dragged.

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
  battlefieldEl,
  buildSeatGameState,
  cardEl,
  layoutBoxes,
  pileEl,
  pointerDrag,
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

const BOLT = makeCard({ id: 10, name: 'Bolt', x: 3, y: 1 });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const LENT_CARDS = [makeCard({ id: 0, name: 'Lent Card' })];
const OWN_AURA = makeCard({ id: 12, name: 'Pacifism', attachPlayerId: 2, attachZone: ZoneName.TABLE, attachCardId: BEAR.id });
const OPP_AURA = makeCard({ id: 22, name: 'Rancor', attachPlayerId: 1, attachZone: ZoneName.TABLE, attachCardId: BOLT.id });
const OWN_BF = { left: 0, top: 500, width: 800, height: 400 };
const OPP_BF = { left: 0, top: 0, width: 800, height: 400 };
const OWN_GRAVE = { left: 900, top: 500, width: 80, height: 110 };
const OPP_GRAVE = { left: 900, top: 0, width: 80, height: 110 };

function renderGame(
  incomingReveal?: object,
  { spectator = false, judge = false, attachments = false } = {},
) {
  const preloadedState = buildSeatGameState({
    localPlayerId: 1,
    spectator,
    judge,
    seats: [
      { playerId: 1, table: attachments ? [BOLT, OWN_AURA] : [BOLT], grave: [makeCard({ id: 40, name: 'Opt' })] },
      {
        playerId: 2,
        table: attachments ? [BEAR, OPP_AURA] : [BEAR],
        handCount: 5,
        grave: [makeCard({ id: 41, name: 'Duress' })],
      },
    ],
  });
  if (incomingReveal) {
    preloadedState.games = { ...preloadedState.games!, incomingReveal } as typeof preloadedState.games;
    preloadedState.games!.games![1]!.players![2]!.zones![ZoneName.DECK]!.revealedCards = LENT_CARDS;
  }
  const webClient = createMockWebClient();
  renderWithProviders(<Game />, { preloadedState, webClient });

  const own = battlefieldEl(1);
  const opp = battlefieldEl(2);
  const ownGrave = pileEl('Graveyard', 0);
  const oppGrave = pileEl('Graveyard', 1);
  layoutBoxes([
    [(el) => el === own || el === own.firstElementChild, OWN_BF],
    [(el) => el === opp || el === opp.firstElementChild, OPP_BF],
    [(el) => el === ownGrave, OWN_GRAVE],
    [(el) => el === oppGrave, OPP_GRAVE],
  ]);
  return webClient.request.game;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Game drag-drop across seats', () => {
  it('disposes an active drag when the board unmounts before release', () => {
    const game = renderGame();
    fireEvent.pointerDown(cardEl(BOLT.id, 'battlefield'), { button: 0, clientX: 10, clientY: 510 });
    fireEvent.pointerMove(window, { clientX: 920, clientY: 520 });
    cleanup();
    fireEvent.pointerUp(window, { button: 0, clientX: 920, clientY: 520 });
    expect(game.moveCard).not.toHaveBeenCalled();
  });

  it('removes pending pointer listeners on board unmount without waiting for release', () => {
    renderGame();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    fireEvent.pointerDown(cardEl(BOLT.id, 'battlefield'), { button: 0, clientX: 10, clientY: 510 });
    const listeners = add.mock.calls.filter(([type]) => ['pointermove', 'pointerup', 'pointercancel'].includes(type));
    expect(listeners.length).toBe(3);
    cleanup();
    for (const [type, listener] of listeners) {
      expect(remove).toHaveBeenCalledWith(type, listener);
    }
    fireEvent.pointerUp(window, { button: 0, clientX: 10, clientY: 510 });
  });

  it('gifts a battlefield card onto an opponent battlefield, resolved against their board', () => {
    const game = renderGame();

    pointerDrag(cardEl(BOLT.id, 'battlefield'), { x: 10, y: 510 }, { x: 15, y: 20 });

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: BOLT.id }] },
      targetPlayerId: 2,
      targetZone: ZoneName.TABLE,
      x: 0,
      y: 2,
    });
  });

  it('drops outside every zone without sending a command', () => {
    const game = renderGame();

    pointerDrag(cardEl(BOLT.id, 'battlefield'), { x: 10, y: 510 }, { x: 2000, y: 2000 });

    expect(game.moveCard).not.toHaveBeenCalled();
  });

  it('does not drag an opponent card: the press only selects it', () => {
    const game = renderGame();

    pointerDrag(cardEl(BEAR.id, 'battlefield'), { x: 10, y: 10 }, { x: 920, y: 20 });

    expect(game.moveCard).not.toHaveBeenCalled();
    expect(document.querySelector('[data-card][data-selected]')?.getAttribute('data-card-id')).toBe(String(BEAR.id));
  });

  it('lets a judge drag an opponent card, sent as that player through Command_Judge', () => {
    const game = renderGame(undefined, { judge: true });

    pointerDrag(cardEl(BEAR.id, 'battlefield'), { x: 10, y: 10 }, { x: 920, y: 20 });

    expect(vi.mocked(game.moveCard).mock.calls.map(([, params, judgeTargetId]) => [params, judgeTargetId])).toEqual([
      [
        {
          startPlayerId: 2,
          startZone: ZoneName.TABLE,
          cardsToMove: { card: [{ cardId: BEAR.id }] },
          targetPlayerId: 2,
          targetZone: ZoneName.GRAVE,
          x: 0,
          y: 0,
          isReversed: false,
        },
        2,
      ],
    ]);
  });

  describe('a card attached across seats', () => {
    function inBoard(cardId: number, playerId: number): HTMLElement {
      const el = battlefieldEl(playerId).querySelector<HTMLElement>(`[data-card][data-card-id="${cardId}"]`);
      if (!el) {
        throw new Error(`card ${cardId} is not on player ${playerId}'s battlefield`);
      }
      return el;
    }

    it('drags the local player\'s card off an opponent\'s board, from the owner\'s table', () => {
      const game = renderGame(undefined, { attachments: true });

      pointerDrag(inBoard(OWN_AURA.id, 2), { x: 10, y: 10 }, { x: 920, y: 520 });

      expect(vi.mocked(game.moveCard).mock.calls.map(([, params, judgeTargetId]) => [params, judgeTargetId])).toEqual([
        [
          {
            startPlayerId: 1,
            startZone: ZoneName.TABLE,
            cardsToMove: { card: [{ cardId: OWN_AURA.id }] },
            targetPlayerId: 1,
            targetZone: ZoneName.GRAVE,
            x: 0,
            y: 0,
            isReversed: false,
          },
          undefined,
        ],
      ]);
    });

    it('does not drag an opponent\'s card shown on the local board: the press only selects it', () => {
      const game = renderGame(undefined, { attachments: true });

      pointerDrag(inBoard(OPP_AURA.id, 1), { x: 10, y: 510 }, { x: 920, y: 520 });

      expect(game.moveCard).not.toHaveBeenCalled();
      expect(document.querySelector('[data-card][data-selected]')?.getAttribute('data-card-id')).toBe(String(OPP_AURA.id));
    });

    it('lets a judge drag it, sent as its owner through Command_Judge', () => {
      const game = renderGame(undefined, { judge: true, attachments: true });

      pointerDrag(inBoard(OPP_AURA.id, 1), { x: 10, y: 510 }, { x: 920, y: 20 });

      expect(vi.mocked(game.moveCard).mock.calls.map(([, params, judgeTargetId]) => [params, judgeTargetId])).toEqual([
        [
          {
            startPlayerId: 2,
            startZone: ZoneName.TABLE,
            cardsToMove: { card: [{ cardId: OPP_AURA.id }] },
            targetPlayerId: 2,
            targetZone: ZoneName.GRAVE,
            x: 0,
            y: 0,
            isReversed: false,
          },
          2,
        ],
      ]);
    });
  });

  describe('lent library (reveal with write access)', () => {
    const LEND = {
      gameId: 1,
      sourceOwnerId: 2,
      zoneName: ZoneName.DECK,
      cards: LENT_CARDS,
      grantWriteAccess: true,
    };

    it('drags onto the own battlefield with the lender as the start player and the deck position as card id', () => {
      const game = renderGame(LEND);

      pointerDrag(screen.getByTitle('Lent Card'), { x: 1000, y: 1000 }, { x: 15, y: 520 });

      expect(game.moveCard).toHaveBeenCalledTimes(1);
      expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
        startPlayerId: 2,
        startZone: ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 0 }] },
        targetPlayerId: 1,
        targetZone: ZoneName.TABLE,
      });
    });

    it('only lands on a battlefield: a drop on the own graveyard is ignored', () => {
      const game = renderGame(LEND);

      pointerDrag(screen.getByTitle('Lent Card'), { x: 1000, y: 1000 }, { x: 920, y: 520 });

      expect(game.moveCard).not.toHaveBeenCalled();
    });

    it('is not draggable for a spectator', () => {
      const game = renderGame(LEND, { spectator: true });

      pointerDrag(screen.getByTitle('Lent Card'), { x: 1000, y: 1000 }, { x: 15, y: 520 });

      expect(game.moveCard).not.toHaveBeenCalled();
    });

    it('is not draggable without write access', () => {
      const game = renderGame({ ...LEND, grantWriteAccess: false });

      pointerDrag(screen.getByTitle('Lent Card'), { x: 1000, y: 1000 }, { x: 15, y: 520 });

      expect(game.moveCard).not.toHaveBeenCalled();
    });
  });
});
