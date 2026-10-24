import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';

const { mockUseWebClient } = vi.hoisted(() => ({ mockUseWebClient: vi.fn() }));
vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: mockUseWebClient };
});

import { useGameDnd } from './useGameDnd';

function makeWebClient() {
  return {
    request: {
      game: {
        moveCard: vi.fn(),
      },
    },
  } as any;
}

function clientRect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height } as any;
}

describe('useGameDnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDragStart', () => {
    it('cancels the pending arrow, whatever is dragged', () => {
      mockUseWebClient.mockReturnValue(makeWebClient());
      const cancelPendingArrow = vi.fn();
      const { result } = renderHook(() => useGameDnd({ gameId: 42, judgeTarget: () => undefined, cancelPendingArrow }));

      result.current.handleDragStart({ active: { id: 1, data: { current: undefined } } } as never);

      expect(cancelPendingArrow).toHaveBeenCalledTimes(1);
    });

    it('lands nothing that is not a seat drag', () => {
      mockUseWebClient.mockReturnValue(makeWebClient());
      const { result } = renderHook(() => useGameDnd({ gameId: 42, judgeTarget: () => undefined, cancelPendingArrow: vi.fn() }));
      const rect = clientRect(0, 0, 100, 100);
      const zone = { id: 'row', node: { current: null }, data: { current: { targetZone: ZoneName.TABLE } } };

      expect(result.current.collisionDetection({
        active: { id: 'a', data: { current: { card: { id: 1 } } } },
        collisionRect: rect,
        droppableRects: new Map([['row', rect]]),
        droppableContainers: [zone],
        pointerCoordinates: { x: 50, y: 50 },
      } as any)).toEqual([]);
    });
  });

  describe('seat drags', () => {
    const seatSource = (overrides: Record<string, unknown> = {}) => ({
      kind: 'seat',
      seatPlayerId: 2,
      zone: 'battlefield',
      cards: [{ id: '20' }],
      activationDistance: 4,
      ...overrides,
    });
    const seatZone = (id: string, priority: number, overrides: Record<string, unknown> = {}) => ({
      id,
      node: { current: null },
      data: {
        current: {
          kind: 'seat-drop',
          seatPlayerId: 2,
          priority,
          resolve: () => ({ zone: 'graveyard' }),
          ...overrides,
        },
      },
    });

    function setupSeat({ judgeTarget = () => undefined, isJudge = false }: {
      judgeTarget?: (owner: number) => number | undefined;
      isJudge?: boolean;
    } = {}) {
      mockUseWebClient.mockReturnValue(makeWebClient());
      const moveCard = vi.fn();
      const clearSelection = vi.fn();
      const { result } = renderHook(() =>
        useGameDnd({
          gameId: 42,
          judgeTarget,
          isJudge,
          cancelPendingArrow: vi.fn(),
          clearSelection,
          moveCard,
        }),
      );
      return { result, moveCard, clearSelection };
    }

    function seatDrop(source: object, over: ReturnType<typeof seatZone> | null) {
      return {
        active: { id: 'seat-2-battlefield', data: { current: source }, rect: { current: { initial: null } } },
        activatorEvent: { clientX: 10, clientY: 10 },
        delta: { x: 5, y: 5 },
        over: over && { id: over.id, data: over.data },
      } as unknown as DragEndEvent;
    }

    it('hit-tests seat zones at the pointer: the accepting zone with the highest priority wins', () => {
      const { result } = setupSeat();
      const rect = clientRect(0, 0, 100, 100);
      const dialog = seatZone('dialog', 90);
      const board = seatZone('board', 50, { seatPlayerId: 1, acceptsOtherSeats: true });
      const otherSeatPile = seatZone('pile', 99, { seatPlayerId: 1 });
      const structured = { id: 'structured', node: { current: null }, data: { current: { targetZone: 'grave' } } };
      const collisions = result.current.collisionDetection({
        active: { id: 'a', data: { current: seatSource() } },
        collisionRect: rect,
        droppableRects: new Map([['dialog', rect], ['board', rect], ['pile', rect], ['structured', rect]]),
        droppableContainers: [board, dialog, otherSeatPile, structured],
        pointerCoordinates: { x: 50, y: 50 },
      } as any);

      expect(collisions.map((c) => c.id)).toEqual(['dialog', 'board']);
    });

    it.each([[false, true], [true, true], [false, false]])('respects the front panel (%s, %s)', (reversed, accepting) => {
      const { result, moveCard } = setupSeat();
      const rect = clientRect(0, 0, 100, 100);
      const graveNode = document.createElement('div');
      const exileNode = document.createElement('div');
      const card = document.createElement('span');
      exileNode.append(card);
      const grave = { ...seatZone('grave', 100), node: { current: graveNode } };
      const exile = {
        ...seatZone('exile', 90, { seatPlayerId: accepting ? 2 : 3, resolve: () => ({ zone: 'exile' }) }),
        node: { current: exileNode },
      };
      const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
      Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [card, exileNode, graveNode] });
      try {
        const containers = reversed ? [exile, grave] : [grave, exile];
        const collisions = result.current.collisionDetection({
          active: { id: 'a', data: { current: seatSource() } },
          collisionRect: rect,
          droppableRects: new Map([['grave', rect], ['exile', rect]]),
          droppableContainers: containers,
          pointerCoordinates: { x: 50, y: 50 },
        } as any);
        if (!accepting) {
          expect(collisions).toEqual([]);
          return;
        }
        expect(collisions.map((c) => c.id)).toEqual(['exile']);
        result.current.handleDragEnd(seatDrop(seatSource(), containers.find((c) => c.id === collisions[0].id)!));
        expect(moveCard).toHaveBeenCalledWith(expect.objectContaining({ targetZone: ZoneName.EXILE }));
      } finally {
        if (original) {
          Object.defineProperty(document, 'elementsFromPoint', original);
        } else {
          Reflect.deleteProperty(document, 'elementsFromPoint');
        }
      }
    });

    it('sends the planned move through the move path and ends the selection', () => {
      const { result, moveCard, clearSelection } = setupSeat();

      result.current.handleDragEnd(seatDrop(seatSource(), seatZone('pile', 10)));

      expect(moveCard).toHaveBeenCalledTimes(1);
      expect(moveCard).toHaveBeenCalledWith(
        expect.objectContaining({ startPlayerId: 2, startZone: ZoneName.TABLE, targetZone: ZoneName.GRAVE }),
      );
      expect(clearSelection).toHaveBeenCalledTimes(1);
    });

    it('sends a judge’s move of another seat’s cards through Command_Judge, but not a lent-zone move', () => {
      const { result, moveCard } = setupSeat({ judgeTarget: (owner) => (owner === 1 ? undefined : owner) });
      const webClient = mockUseWebClient.mock.results.at(-1)!.value as ReturnType<typeof makeWebClient>;
      const ownBoard = seatZone('board', 50, {
        seatPlayerId: 1,
        resolve: () => ({ zone: 'battlefield', playerId: 1, slot: { row: 0, col: 0 }, grid: { rows: 3, cols: 5 } }),
      });

      result.current.handleDragEnd(seatDrop(seatSource(), seatZone('pile', 10)));
      result.current.handleDragEnd(seatDrop(
        seatSource({ seatPlayerId: 1, zone: 'library', lenderPlayerId: 2, cards: [{ id: '0' }] }),
        ownBoard,
      ));

      expect(webClient.request.game.moveCard).toHaveBeenCalledTimes(1);
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ startPlayerId: 2, targetZone: ZoneName.GRAVE }),
        2,
      );
      expect(moveCard).toHaveBeenCalledTimes(1);
      expect(moveCard).toHaveBeenCalledWith(expect.objectContaining({ startPlayerId: 2, startZone: ZoneName.DECK }));
    });

    it('drops a lent card only on the borrower’s battlefield, unless the mover is a judge', () => {
      const lent = seatSource({ seatPlayerId: 1, zone: 'library', lenderPlayerId: 2, cards: [{ id: '0' }] });
      const lenderBoard = seatZone('board', 50, {
        seatPlayerId: 2,
        resolve: () => ({ zone: 'battlefield', playerId: 2, slot: { row: 0, col: 0 }, grid: { rows: 3, cols: 5 } }),
      });

      const player = setupSeat();
      player.result.current.handleDragEnd(seatDrop(lent, lenderBoard));
      expect(player.moveCard).not.toHaveBeenCalled();

      const judge = setupSeat({ isJudge: true });
      judge.result.current.handleDragEnd(seatDrop(lent, lenderBoard));
      expect(judge.moveCard).toHaveBeenCalledWith(
        expect.objectContaining({ startPlayerId: 2, startZone: ZoneName.DECK, targetPlayerId: 2, targetZone: ZoneName.TABLE }),
      );
    });

    it('sends nothing for a drop outside every seat zone', () => {
      const { result, moveCard } = setupSeat();

      result.current.handleDragEnd(seatDrop(seatSource(), null));

      expect(moveCard).not.toHaveBeenCalled();
    });
  });
});
