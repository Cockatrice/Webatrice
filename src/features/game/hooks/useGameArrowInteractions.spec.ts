import { createRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { createCardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import { makeCard, makeGameEntry, makePlayerEntry, makePlayerProperties } from '../../../__test-utils__/games-fixtures';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { ZoneName } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { useGameArrowInteractions } from './useGameArrowInteractions';

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn() },
}));

vi.mock('../../../hooks/useSettings');

function setup({ localPlayerId = 1 }: { localPlayerId?: number } = {}) {
  const game = makeGameEntry({
    localPlayerId,
    players: {
      [localPlayerId]: makePlayerEntry({
        properties: makePlayerProperties({ playerId: localPlayerId }),
      }),
    },
  });
  const gamesState: GamesState = { games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } };

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
        game: { ...game, info: { ...game.info, gameId: 1 } },
        boardRef,
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

  it('creates an arrow after right-click-drag past the 8px threshold', () => {
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

  it('plays the card (moveCard) when dragging from HAND to a non-HAND target', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });
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

    expect(webClient.request.game.moveCard).toHaveBeenCalled();
    expect(webClient.request.game.createArrow).not.toHaveBeenCalled();

    document.elementFromPoint = origElementFromPoint;
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

  it('ESC cancels pending arrow state', () => {
    const { result } = setup();

    act(() => {
      result.current.startPendingArrow({ sourcePlayerId: 1, sourceZone: ZoneName.TABLE, sourceCardId: 5 });
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
    // event reached handleCardClick. The fix adds `distance: 8` to the
    // sensor in useGame.ts; this spec covers handleCardClick's contract
    // directly so the click-through-attach path is no longer untested.

    it('dispatches attachCard when handleCardClick fires on a different card while pendingAttach is set', () => {
      const { result, webClient } = setup();

      act(() => {
        result.current.startPendingAttach({
          sourcePlayerId: 1,
          sourceZone: ZoneName.TABLE,
          sourceCardId: 5,
        });
      });
      expect(result.current.arrowSourceKey).not.toBeNull();

      act(() => {
        result.current.handleCardClick(2, ZoneName.TABLE, makeCard({ id: 99 }));
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
      );
      // Pending state cleared after dispatch so subsequent clicks don't
      // re-attach.
      expect(result.current.arrowSourceKey).toBeNull();
    });

    it('cancels pendingAttach without dispatching attachCard when the user clicks the source card itself', () => {
      const { result, webClient } = setup();

      act(() => {
        result.current.startPendingAttach({
          sourcePlayerId: 1,
          sourceZone: ZoneName.TABLE,
          sourceCardId: 5,
        });
      });

      act(() => {
        result.current.handleCardClick(1, ZoneName.TABLE, makeCard({ id: 5 }));
      });

      expect(webClient.request.game.attachCard).not.toHaveBeenCalled();
      expect(result.current.arrowSourceKey).toBeNull();
    });
  });

  describe('handleCardDoubleClick — hand → play', () => {
    function makeCardMeta(tablerow: string | null) {
      if (tablerow == null) {
        return { name: { value: 'Foo' } };
      }
      return { name: { value: 'Foo' }, tablerow: { value: tablerow } };
    }

    afterEach(() => {
      vi.mocked(CardDTO.get).mockReset();
    });

    it('moves an instant/sorcery (tablerow=3) from hand to STACK', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('3') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 7, name: 'Counterspell' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.HAND,
          targetZone: ZoneName.STACK,
          cardsToMove: { card: [expect.objectContaining({ cardId: 7 })] },
        }),
      );
    });

    it('moves a creature (tablerow=1) from hand to TABLE row y=1', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('1') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 8, name: 'Bear' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.HAND,
          targetZone: ZoneName.TABLE,
          y: 1,
        }),
      );
    });

    it('moves an artifact/enchantment (tablerow=2) from hand to TABLE top row y=0', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('2') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 9, name: 'Sol Ring' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.HAND,
          targetZone: ZoneName.TABLE,
          y: 0,
        }),
      );
    });

    it('moves a land (tablerow=0) from hand to TABLE bottom row y=2', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('0') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 10, name: 'Forest' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.HAND,
          targetZone: ZoneName.TABLE,
          y: 2,
        }),
      );
    });

    it('defaults missing tablerow to TABLE top row y=0', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta(null) as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 11, name: 'Mystery Card' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: ZoneName.HAND,
          targetZone: ZoneName.TABLE,
          y: 0,
        }),
      );
    });

    it('defaults to top row when CardDTO.get returns nothing', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(ZoneName.HAND, makeCard({ id: 12, name: 'Unknown' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          targetZone: ZoneName.TABLE,
          y: 0,
        }),
      );
    });

    it('still toggles tap on TABLE double-click (existing behavior preserved)', () => {
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(
          ZoneName.TABLE,
          makeCard({ id: 5, tapped: false }),
        );
      });

      expect(webClient.request.game.setCardAttr).toHaveBeenCalled();
      expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    });
  });

  it('ESC does not cancel while a MUI dialog is open', () => {
    const { result } = setup();

    const dialog = document.createElement('div');
    dialog.className = 'MuiDialog-root';
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    act(() => {
      result.current.startPendingArrow({ sourcePlayerId: 1, sourceZone: ZoneName.TABLE, sourceCardId: 5 });
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.arrowSourceKey).not.toBeNull();
  });
});
