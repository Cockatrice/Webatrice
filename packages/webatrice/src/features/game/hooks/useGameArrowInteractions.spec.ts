import { ZoneName } from '@cockatrice/sockatrice';
import { createRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { createCardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import { makeCard, makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { useGameArrowInteractions } from './useGameArrowInteractions';

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(() => Promise.resolve(undefined)) },
}));

vi.mock('../../../services/cards/catalog/lookup', async () =>
  (await import('../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

vi.mock('../../../hooks/useSettings');

function setup({
  localPlayerId = 1,
  handCards = [],
  judge = false,
  extraPlayers = {},
}: {
  localPlayerId?: number;
  handCards?: ReturnType<typeof makeCard>[];
  judge?: boolean;
  extraPlayers?: GamesState['games'][number]['players'];
} = {}) {
  const game = makeGameEntry({
    localPlayerId,
    judge,
    players: {
      [localPlayerId]: makePlayerEntry({
        properties: makePlayerProperties({ playerId: localPlayerId }),
        zones: {
          hand: makeZoneEntry({ name: ZoneName.HAND, cards: handCards }),
          deck: makeZoneEntry({ name: ZoneName.DECK }),
          table: makeZoneEntry({ name: ZoneName.TABLE }),
        },
      }),
      ...extraPlayers,
    },
  });
  const gamesState: GamesState = { games: { 1: { ...game, info: { ...game.info, gameId: 1 } } }, pings: {} };

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const boardRef = createRef<HTMLDivElement>();
  const board = document.createElement('div');
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  (boardRef as { current: HTMLDivElement | null }).current = board;

  const cardRegistry = createCardRegistry();

  const { result } = renderHook(
    () =>
      useGameArrowInteractions({
        gameId: 1,
        containerRef: boardRef,
        cardRegistry,
      }),
    { wrapper: Wrapper },
  );

  return { result, webClient, boardRef };
}

function makeCardElement({
  playerId,
  zone,
  cardId,
}: {
  playerId: number;
  zone: string;
  cardId: number;
}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-card-id', String(cardId));
  el.setAttribute('data-card-owner', String(playerId));
  el.setAttribute('data-card-zone', zone);
  document.body.appendChild(el);
  return el;
}

function fireMouseEvent(type: string, init: Partial<MouseEventInit> = {}) {
  window.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
}

describe('useGameArrowInteractions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates an arrow after right-click-drag past the 4px threshold', () => {
    const { result, webClient } = setup();
    const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 10,
        clientY: 10,
        target: makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 }),
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });

    act(() => {
      fireMouseEvent('mousemove', { clientX: 30, clientY: 30 });
    });

    act(() => {
      fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 });
    });

    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        startCardId: 5,
        targetPlayerId: 2,
        targetCardId: 99,
        targetZone: ZoneName.TABLE,
      }),
    );

    document.elementFromPoint = origElementFromPoint;
  });

  it('plays the card AND draws the arrow when dragging from HAND to a non-HAND target', async () => {
    const handCard = makeCard({ id: 5, name: 'Grizzly Bears' });
    const { result, webClient } = setup({ localPlayerId: 1, handCards: [handCard] });
    vi.mocked(CardDTO.get).mockResolvedValueOnce(undefined);
    const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        target: makeCardElement({ playerId: 1, zone: ZoneName.HAND, cardId: 5 }),
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });
    act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));
    act(() => fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 }));

    await waitFor(() => expect(webClient.request.game.createArrow).toHaveBeenCalled());
    expect(webClient.request.game.moveCard).toHaveBeenCalled();
    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        startZone: ZoneName.STACK,
        startCardId: 5,
        targetPlayerId: 2,
        targetZone: ZoneName.TABLE,
        targetCardId: 99,
      }),
    );

    document.elementFromPoint = origElementFromPoint;
  });

  it('rewrites startZone to STACK when the hand card has tablerow=3', async () => {
    const handCard = makeCard({ id: 5, name: 'Lightning Bolt' });
    const { result, webClient } = setup({ localPlayerId: 1, handCards: [handCard] });
    vi.mocked(CardDTO.get).mockResolvedValueOnce({ tablerow: { value: '3' } } as never);
    const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        target: makeCardElement({ playerId: 1, zone: ZoneName.HAND, cardId: 5 }),
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });
    act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));
    act(() => fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 }));

    await waitFor(() => expect(webClient.request.game.createArrow).toHaveBeenCalled());
    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startZone: ZoneName.STACK,
        startCardId: 5,
      }),
    );

    document.elementFromPoint = origElementFromPoint;
  });

  it('click-target from HAND to battlefield plays the card AND draws the arrow', async () => {
    const handCard = makeCard({ id: 5, name: 'Grizzly Bears' });
    const { result, webClient } = setup({ localPlayerId: 1, handCards: [handCard] });
    vi.mocked(CardDTO.get).mockResolvedValueOnce(undefined);

    act(() => {
      result.current.pendingTarget.startArrow({ playerId: 1, zone: ZoneName.HAND, cardId: 5, name: '' });
    });
    act(() => {
      result.current.pendingTarget.pick({ kind: 'card', playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
    });

    await waitFor(() => expect(webClient.request.game.createArrow).toHaveBeenCalled());
    expect(webClient.request.game.moveCard).toHaveBeenCalled();
    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        startZone: ZoneName.STACK,
        startCardId: 5,
        targetPlayerId: 2,
        targetZone: ZoneName.TABLE,
        targetCardId: 99,
      }),
    );
  });

  it('does not send a request when the drop lands on the same card (cancel)', () => {
    const { result, webClient } = setup();
    const sameEl = makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => sameEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        target: sameEl,
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });
    act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));
    act(() => fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 }));

    expect(webClient.request.game.createArrow).not.toHaveBeenCalled();

    document.elementFromPoint = origElementFromPoint;
  });

  it('does not send a request when mouseup is below the drag threshold', () => {
    const { result, webClient } = setup();
    const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 10,
        clientY: 10,
        target: makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 }),
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });
    act(() => fireMouseEvent('mouseup', { button: 2, clientX: 12, clientY: 12 }));

    expect(webClient.request.game.createArrow).not.toHaveBeenCalled();
    expect(webClient.request.game.moveCard).not.toHaveBeenCalled();

    document.elementFromPoint = origElementFromPoint;
  });

  describe('arrowTargetKey hover tracking', () => {
    it('is null before drag starts and before threshold is crossed', () => {
      const { result } = setup();
      expect(result.current.arrowTargetKey).toBeNull();

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 }),
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      // Sub-threshold move; arrowTargetKey should stay null.
      const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;
      act(() => fireMouseEvent('mousemove', { clientX: 11, clientY: 11 }));
      expect(result.current.arrowTargetKey).toBeNull();
      document.elementFromPoint = origElementFromPoint;
    });

    it('reflects the card under the cursor once moved past the threshold', () => {
      const { result } = setup();
      const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 }),
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));

      expect(result.current.arrowTargetKey).toBe(`2-${ZoneName.TABLE}-99`);

      document.elementFromPoint = origElementFromPoint;
    });

    it('is null when the cursor is over the source card itself', () => {
      const { result } = setup();
      const sourceEl = makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => sourceEl;

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: sourceEl,
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));

      expect(result.current.arrowTargetKey).toBeNull();

      document.elementFromPoint = origElementFromPoint;
    });

    it('clears on mouseup', () => {
      const { result } = setup();
      const targetEl = makeCardElement({ playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: makeCardElement({ playerId: 1, zone: ZoneName.TABLE, cardId: 5 }),
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));
      expect(result.current.arrowTargetKey).not.toBeNull();

      act(() => fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 }));
      expect(result.current.arrowTargetKey).toBeNull();

      document.elementFromPoint = origElementFromPoint;
    });
  });

  it('ESC cancels pending arrow state', () => {
    const { result } = setup();

    act(() => {
      result.current.pendingTarget.startArrow({ playerId: 1, zone: ZoneName.TABLE, cardId: 5, name: '' });
    });
    expect(result.current.arrowSourceKey).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.arrowSourceKey).toBeNull();
  });

  describe('context-menu attach flow', () => {
    // Regression: dnd-kit's PointerSensor used to fire onDragStart on every
    // pointerdown (no activationConstraint), which routed through
    // cancelPendingOnDragStart and wiped pendingAttach before the click
    // event reached handleCardClick. GamePointerSensor now starts a drag only
    // on motion (useGame.ts); this spec covers handleCardClick's contract
    // directly so the click-through-attach path is no longer untested.

    it('dispatches attachCard when a different card is picked while pendingAttach is set', () => {
      const { result, webClient } = setup();

      act(() => {
        result.current.pendingTarget.startAttach({ playerId: 1, zone: ZoneName.TABLE, cardId: 5, name: '' });
      });
      expect(result.current.arrowSourceKey).not.toBeNull();

      act(() => {
        result.current.pendingTarget.pick({ kind: 'card', playerId: 2, zone: ZoneName.TABLE, cardId: 99 });
      });

      expect(webClient.request.game.attachCard).toHaveBeenCalledTimes(1);
      expect(webClient.request.game.attachCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.TABLE,
          cardId: 5,
          targetPlayerId: 2,
          targetZone: ZoneName.TABLE,
          targetCardId: 99,
        }),
        undefined, // non-judge actor → no judge wrap
      );
      // Pending state cleared after dispatch so subsequent clicks don't
      // re-attach.
      expect(result.current.arrowSourceKey).toBeNull();
    });

    it('cancels pendingAttach without dispatching attachCard when the user clicks the source card itself', () => {
      const { result, webClient } = setup();

      act(() => {
        result.current.pendingTarget.startAttach({ playerId: 1, zone: ZoneName.TABLE, cardId: 5, name: '' });
      });

      act(() => {
        result.current.pendingTarget.pick({ kind: 'card', playerId: 1, zone: ZoneName.TABLE, cardId: 5 });
      });

      expect(webClient.request.game.attachCard).not.toHaveBeenCalled();
      expect(result.current.arrowSourceKey).toBeNull();
    });
  });

  it('ESC does not cancel while a MUI dialog is open', () => {
    const { result } = setup();

    const dialog = document.createElement('div');
    dialog.className = 'MuiDialog-root';
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    act(() => {
      result.current.pendingTarget.startArrow({ playerId: 1, zone: ZoneName.TABLE, cardId: 5, name: '' });
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.arrowSourceKey).not.toBeNull();
  });
});
