import { createRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { createCardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { combineReducers } from '@reduxjs/toolkit';

import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { games, type GamesState } from '@cockatrice/datatrice';
import { makeCard, makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { Enriched } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { useGameArrowInteractions } from './useGameArrowInteractions';

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(() => Promise.resolve(undefined)) },
}));

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
          hand: makeZoneEntry({ name: Enriched.ZoneName.HAND, cards: handCards }),
          deck: makeZoneEntry({ name: Enriched.ZoneName.DECK }),
          table: makeZoneEntry({ name: Enriched.ZoneName.TABLE }),
        },
      }),
      ...extraPlayers,
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
        containerRef: boardRef,
        cardRegistry,
        selectedCards: [],
        collapseUnlessSelected: vi.fn(),
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
    const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 10,
        clientY: 10,
        target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 }),
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
        targetZone: Enriched.ZoneName.TABLE,
      }),
    );

    document.elementFromPoint = origElementFromPoint;
  });

  it('plays the card AND draws the arrow when dragging from HAND to a non-HAND target', async () => {
    const handCard = makeCard({ id: 5, name: 'Grizzly Bears' });
    const { result, webClient } = setup({ localPlayerId: 1, handCards: [handCard] });
    vi.mocked(CardDTO.get).mockResolvedValueOnce(undefined);
    const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.HAND, cardId: 5 }),
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
        startZone: Enriched.ZoneName.TABLE,
        startCardId: 5,
        targetPlayerId: 2,
        targetZone: Enriched.ZoneName.TABLE,
        targetCardId: 99,
      }),
    );

    document.elementFromPoint = origElementFromPoint;
  });

  it('rewrites startZone to STACK when the hand card has tablerow=3', async () => {
    const handCard = makeCard({ id: 5, name: 'Lightning Bolt' });
    const { result, webClient } = setup({ localPlayerId: 1, handCards: [handCard] });
    vi.mocked(CardDTO.get).mockResolvedValueOnce({ tablerow: { value: '3' } } as never);
    const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.HAND, cardId: 5 }),
      } as unknown as React.MouseEvent<HTMLDivElement>);
    });
    act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));
    act(() => fireMouseEvent('mouseup', { button: 2, clientX: 30, clientY: 30 }));

    await waitFor(() => expect(webClient.request.game.createArrow).toHaveBeenCalled());
    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startZone: Enriched.ZoneName.STACK,
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
      result.current.startPendingArrow({
        sourcePlayerId: 1,
        sourceZone: Enriched.ZoneName.HAND,
        sourceCardId: 5,
      });
    });
    act(() => {
      result.current.handleCardClick(2, Enriched.ZoneName.TABLE, makeCard({ id: 99 }));
    });

    await waitFor(() => expect(webClient.request.game.createArrow).toHaveBeenCalled());
    expect(webClient.request.game.moveCard).toHaveBeenCalled();
    expect(webClient.request.game.createArrow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        startZone: Enriched.ZoneName.TABLE,
        startCardId: 5,
        targetPlayerId: 2,
        targetZone: Enriched.ZoneName.TABLE,
        targetCardId: 99,
      }),
    );
  });

  it('does not send a request when the drop lands on the same card (cancel)', () => {
    const { result, webClient } = setup();
    const sameEl = makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 });
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
    const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetEl;

    act(() => {
      result.current.handleBoardMouseDown({
        button: 2,
        clientX: 10,
        clientY: 10,
        target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 }),
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
          target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 }),
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      // Sub-threshold move; arrowTargetKey should stay null.
      const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;
      act(() => fireMouseEvent('mousemove', { clientX: 11, clientY: 11 }));
      expect(result.current.arrowTargetKey).toBeNull();
      document.elementFromPoint = origElementFromPoint;
    });

    it('reflects the card under the cursor once moved past the threshold', () => {
      const { result } = setup();
      const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 }),
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => fireMouseEvent('mousemove', { clientX: 30, clientY: 30 }));

      expect(result.current.arrowTargetKey).toBe(`2-${Enriched.ZoneName.TABLE}-99`);

      document.elementFromPoint = origElementFromPoint;
    });

    it('is null when the cursor is over the source card itself', () => {
      const { result } = setup();
      const sourceEl = makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 });
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
      const targetEl = makeCardElement({ playerId: 2, zone: Enriched.ZoneName.TABLE, cardId: 99 });
      const origElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => targetEl;

      act(() => {
        result.current.handleBoardMouseDown({
          button: 2,
          clientX: 10,
          clientY: 10,
          target: makeCardElement({ playerId: 1, zone: Enriched.ZoneName.TABLE, cardId: 5 }),
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
      result.current.startPendingArrow({ sourcePlayerId: 1, sourceZone: Enriched.ZoneName.TABLE, sourceCardId: 5 });
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
          sourceZone: Enriched.ZoneName.TABLE,
          sourceCardId: 5,
        });
      });
      expect(result.current.arrowSourceKey).not.toBeNull();

      act(() => {
        result.current.handleCardClick(2, Enriched.ZoneName.TABLE, makeCard({ id: 99 }));
      });

      expect(webClient.request.game.attachCard).toHaveBeenCalledTimes(1);
      expect(webClient.request.game.attachCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.TABLE,
          cardId: 5,
          targetPlayerId: 2,
          targetZone: Enriched.ZoneName.TABLE,
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
        result.current.startPendingAttach({
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          sourceCardId: 5,
        });
      });

      act(() => {
        result.current.handleCardClick(1, Enriched.ZoneName.TABLE, makeCard({ id: 5 }));
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
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 7, name: 'Counterspell' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.STACK,
          cardsToMove: { card: [expect.objectContaining({ cardId: 7 })] },
        }),
        undefined,
      );
    });

    it('moves a creature (tablerow=1) from hand to TABLE row y=1', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('1') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 8, name: 'Bear' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.TABLE,
          y: 1,
        }),
        undefined,
      );
    });

    it('moves an artifact/enchantment (tablerow=2) from hand to TABLE top row y=0', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('2') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 9, name: 'Sol Ring' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.TABLE,
          y: 0,
        }),
        undefined,
      );
    });

    it('moves a land (tablerow=0) from hand to TABLE bottom row y=2', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta('0') as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 10, name: 'Forest' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.TABLE,
          y: 2,
        }),
        undefined,
      );
    });

    it('defaults missing tablerow to TABLE top row y=0', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(makeCardMeta(null) as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 11, name: 'Mystery Card' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.TABLE,
          y: 0,
        }),
        undefined,
      );
    });

    it('defaults to top row when CardDTO.get returns nothing', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.HAND, makeCard({ id: 12, name: 'Unknown' }));
      });

      await waitFor(() => {
        expect(webClient.request.game.moveCard).toHaveBeenCalled();
      });
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          targetZone: Enriched.ZoneName.TABLE,
          y: 0,
        }),
        undefined,
      );
    });

    it('still toggles tap on TABLE double-click (existing behavior preserved)', () => {
      const { result, webClient } = setup({ localPlayerId: 1 });

      act(() => {
        result.current.handleCardDoubleClick(
          1,
          Enriched.ZoneName.TABLE,
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
      result.current.startPendingArrow({ sourcePlayerId: 1, sourceZone: Enriched.ZoneName.TABLE, sourceCardId: 5 });
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.arrowSourceKey).not.toBeNull();
  });

  describe('judge override', () => {
    type Cards = ReturnType<typeof makeCard>[];
    function opponent(playerId: number, opts: { tableCards?: Cards; handCards?: Cards } = {}) {
      return makePlayerEntry({
        properties: makePlayerProperties({ playerId }),
        zones: {
          hand: makeZoneEntry({ name: Enriched.ZoneName.HAND, cards: opts.handCards ?? [] }),
          deck: makeZoneEntry({ name: Enriched.ZoneName.DECK }),
          table: makeZoneEntry({ name: Enriched.ZoneName.TABLE, cards: opts.tableCards ?? [] }),
        },
      });
    }

    it('double-click tap on an opponent TABLE card wraps as the owner (judge)', () => {
      const card = makeCard({ id: 77, tapped: false });
      const { result, webClient } = setup({ judge: true, extraPlayers: { 2: opponent(2, { tableCards: [card] }) } });

      act(() => {
        result.current.handleCardDoubleClick(2, Enriched.ZoneName.TABLE, card);
      });

      expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ cardId: 77, attribute: CardAttribute.AttrTapped, attrValue: '1' }),
        2, // judge wrap target = owner
      );
    });

    it('double-click tap on an OWN TABLE card sends bare (no judge wrap)', () => {
      const card = makeCard({ id: 78, tapped: false });
      const { result, webClient } = setup({ judge: true, extraPlayers: { 1: opponent(1, { tableCards: [card] }) } });

      act(() => {
        result.current.handleCardDoubleClick(1, Enriched.ZoneName.TABLE, card);
      });

      expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ cardId: 78, attribute: CardAttribute.AttrTapped, attrValue: '1' }),
        undefined,
      );
    });

    it('double-click play of an opponent HAND card lands on the owner table, wrapped (judge)', async () => {
      vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: '1' } } as never);
      const card = makeCard({ id: 88, name: 'Bear' });
      const { result, webClient } = setup({ judge: true, extraPlayers: { 2: opponent(2, { handCards: [card] }) } });

      act(() => {
        result.current.handleCardDoubleClick(2, Enriched.ZoneName.HAND, card);
      });

      await waitFor(() => expect(webClient.request.game.moveCard).toHaveBeenCalled());
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startPlayerId: 2,
          targetPlayerId: 2,
          startZone: Enriched.ZoneName.HAND,
          targetZone: Enriched.ZoneName.TABLE,
        }),
        2, // judge wrap target = owner
      );
    });
  });
});
