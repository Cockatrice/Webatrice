import { renderHook } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import {
  CARD_WIDTH_PX,
  MARGIN_LEFT_PX,
  PADDING_X_PX,
  STACKED_CARD_OFFSET_X_PX,
} from '../components/battlefield/Battlefield/gridMath';

const { mockUseWebClient } = vi.hoisted(() => ({ mockUseWebClient: vi.fn() }));
vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: mockUseWebClient };
});

import { useGameDnd } from './useGameDnd';

// Build a minimal DragEndEvent with only the fields useGameDnd reads. The
// real dnd-kit Event type has many more fields; we cast via `unknown` so
// tests stay tied to actual handler inputs, not dnd-kit internals.
type DropShape = {
  sourceCard: ServerInfo_Card;
  sourcePlayerId: number;
  sourceZone: string;
  sourceIndex?: number;
  targetPlayerId: number;
  targetZone: string;
  targetRow?: number;
  rowCards?: ServerInfo_Card[];
  // Drop-point is expressed as the card center's x relative to the row's
  // content edge (same convention as gridMath.mapToGridX).
  pointerXInRow?: number;
  // Hand/stack reorder: when set, the drop's "over" target is a CardSlot
  // droppable (asReorderSlot=true) that resolves to a specific insertion index.
  targetIndex?: number;
};

const ROW_LEFT = 500;
const CARD_WIDTH_ON_SCREEN = CARD_WIDTH_PX;

function buildEvent(d: DropShape): DragEndEvent {
  const pointerXInRow = d.pointerXInRow ?? 0;
  // Reverse the math computePointerXInRow does: cardCenterX - overRect.left - MARGIN_LEFT.
  const cardCenterXAbs = pointerXInRow + ROW_LEFT + MARGIN_LEFT_PX;
  const activeLeft = cardCenterXAbs - CARD_WIDTH_ON_SCREEN / 2;
  return {
    active: {
      id: d.sourceCard.id,
      data: {
        current: {
          card: d.sourceCard,
          sourcePlayerId: d.sourcePlayerId,
          sourceZone: d.sourceZone,
          sourceIndex: d.sourceIndex,
        },
      },
      rect: {
        current: {
          translated: {
            left: activeLeft,
            top: 0,
            width: CARD_WIDTH_ON_SCREEN,
            height: 204,
            right: activeLeft + CARD_WIDTH_ON_SCREEN,
            bottom: 204,
          },
          initial: null,
        },
      },
    },
    over: {
      id: `battlefield-${d.targetPlayerId}-${d.targetRow ?? 0}`,
      // Row height = 204 so the effective card width derived by useGameDnd
      // (laneHeight × 146/204) equals CARD_WIDTH_PX = 146, keeping the
      // pointer-X math aligned with the test's logical gridMath expectations.
      rect: {
        left: ROW_LEFT,
        top: 0,
        width: 1000,
        height: 204,
        right: ROW_LEFT + 1000,
        bottom: 204,
      } as any,
      data: {
        current: {
          targetPlayerId: d.targetPlayerId,
          targetZone: d.targetZone,
          row: d.targetRow ?? 0,
          rowCards: d.rowCards ?? [],
          ...(d.targetIndex != null
            ? { targetIndex: d.targetIndex, asReorderSlot: true }
            : {}),
        },
      },
      disabled: false,
    } as any,
    delta: { x: 0, y: 0 },
    collisions: null,
    activatorEvent: new Event('pointerdown'),
  } as unknown as DragEndEvent;
}

function makeWebClient() {
  return {
    request: {
      game: {
        moveCard: vi.fn(),
        attachCard: vi.fn(),
      },
    },
  } as any;
}

function setupHook() {
  const webClient = makeWebClient();
  mockUseWebClient.mockReturnValue(webClient);
  const { result } = renderHook(() => useGameDnd({ gameId: 42 }));
  return { webClient, handleDragEnd: result.current.handleDragEnd };
}

describe('useGameDnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('drops on battlefield', () => {
    it('sends moveCard with gridX=0 when dropping into an empty row', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 10, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.HAND,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 1,
          rowCards: [],
          pointerXInRow: 10,
        }),
      );

      expect(webClient.request.game.moveCard).toHaveBeenCalledTimes(1);
      const args = webClient.request.game.moveCard.mock.calls[0][1];
      expect(args.x).toBe(0);
      expect(args.y).toBe(1);
      expect(args.targetZone).toBe(Enriched.ZoneName.TABLE);
    });

    it('sends moveCard with gridX=3 when dropping into the next stack past a 1-card stack', () => {
      const { webClient, handleDragEnd } = setupHook();
      const existing = makeCard({ id: 20, x: 0, y: 0 });
      const dragging = makeCard({ id: 21, x: 0, y: 2 }); // from a different row
      handleDragEnd(
        buildEvent({
          sourceCard: dragging,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 0,
          rowCards: [existing],
          // Pointer well inside stack 1's territory.
          pointerXInRow: CARD_WIDTH_PX + PADDING_X_PX + 10,
        }),
      );

      const args = webClient.request.game.moveCard.mock.calls[0][1];
      expect(args.x).toBe(3);
    });

    it('allows in-row reorder (same-row drop no longer silently rejected)', () => {
      const { webClient, handleDragEnd } = setupHook();
      const leftmost = makeCard({ id: 30, x: 0, y: 1 });
      const dragged = makeCard({ id: 31, x: 1, y: 1 });
      handleDragEnd(
        buildEvent({
          sourceCard: dragged,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 1,
          // Dragged card still appears in rowCards from Redux during the drag.
          rowCards: [leftmost, dragged],
          // Drop far enough right that the dragged card lands in a new stack.
          pointerXInRow: CARD_WIDTH_PX + PADDING_X_PX + 10,
        }),
      );

      expect(webClient.request.game.moveCard).toHaveBeenCalledTimes(1);
      // Dragged card excluded from occupancy → stack 1 base (3) is free.
      expect(webClient.request.game.moveCard.mock.calls[0][1].x).toBe(3);
    });

    it('places into sub-position 1 when the stack base is occupied by another card', () => {
      const { webClient, handleDragEnd } = setupHook();
      const occupying = makeCard({ id: 40, x: 0, y: 0 });
      const dragging = makeCard({ id: 41, x: 0, y: 2 }); // different row
      handleDragEnd(
        buildEvent({
          sourceCard: dragging,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 0,
          rowCards: [occupying],
          // Inside stack 0's territory (mapToGridX returns something in [0,2]).
          pointerXInRow: STACKED_CARD_OFFSET_X_PX / 2,
        }),
      );

      // base 0 occupied → closestGridPoint bumps to 1.
      expect(webClient.request.game.moveCard.mock.calls[0][1].x).toBe(1);
    });

    it('rejects a drop silently when the target stack is fully occupied', () => {
      const { webClient, handleDragEnd } = setupHook();
      const dragging = makeCard({ id: 50, x: 0, y: 2 });
      const full = [
        makeCard({ id: 51, x: 0, y: 0 }),
        makeCard({ id: 52, x: 1, y: 0 }),
        makeCard({ id: 53, x: 2, y: 0 }),
      ];
      handleDragEnd(
        buildEvent({
          sourceCard: dragging,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 0,
          rowCards: full,
          pointerXInRow: 0, // mapToGridX → 0; all three sub-slots full.
        }),
      );

      expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    });

    it('sends the logical y from target.row without re-inverting (mirrored boards)', () => {
      // BattlefieldRow receives `row=rowIdx` where rowIdx iterates rowOrder
      // (mirrored: [2,1,0]). Visual top of a mirrored opponent yields
      // target.row = 2 which IS the correct server-side y. Re-inverting here
      // would send y=0 and render the card at the bottom of the opponent's
      // area — the bug this test guards against.
      const { webClient, handleDragEnd } = setupHook();
      const dragging = makeCard({ id: 60, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: dragging,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.HAND,
          targetPlayerId: 2,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 2, // visual top of mirrored opponent = logical y=2
          rowCards: [],
          pointerXInRow: 0,
        }),
      );

      expect(webClient.request.game.moveCard.mock.calls[0][1].y).toBe(2);
    });
  });

  describe('non-TABLE drops', () => {
    it('sends x=0, y=0 when dropping into a pile zone (graveyard)', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 70, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.GRAVE,
          targetRow: 0,
          pointerXInRow: 500, // ignored for non-TABLE
        }),
      );

      const args = webClient.request.game.moveCard.mock.calls[0][1];
      expect(args.x).toBe(0);
      expect(args.y).toBe(0);
      expect(args.targetZone).toBe(Enriched.ZoneName.GRAVE);
    });

    it('skips dispatch for same-zone hand drop on zone background (no slot resolved)', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 80, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.HAND,
          sourceIndex: 0,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.HAND,
          targetRow: 0,
        }),
      );

      expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    });

    it('skips dispatch for same-zone non-hand-or-stack drops (e.g. deck → deck)', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 81, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.DECK,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.DECK,
          targetRow: 0,
        }),
      );

      expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    });
  });

  describe('hand/stack reorder', () => {
    it('sends moveCard with x=targetIndex when dragging within the hand', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 100, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.HAND,
          sourceIndex: 0,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.HAND,
          targetIndex: 3,
        }),
      );

      expect(webClient.request.game.moveCard).toHaveBeenCalledTimes(1);
      const args = webClient.request.game.moveCard.mock.calls[0][1];
      expect(args.x).toBe(3);
      expect(args.y).toBe(0);
      expect(args.startZone).toBe(Enriched.ZoneName.HAND);
      expect(args.targetZone).toBe(Enriched.ZoneName.HAND);
    });

    it('sends moveCard with x=targetIndex when dragging within the stack pile', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 101 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 2,
          sourceZone: Enriched.ZoneName.STACK,
          sourceIndex: 2,
          targetPlayerId: 2,
          targetZone: Enriched.ZoneName.STACK,
          targetIndex: 0,
        }),
      );

      const args = webClient.request.game.moveCard.mock.calls[0][1];
      expect(args.x).toBe(0);
      expect(args.targetZone).toBe(Enriched.ZoneName.STACK);
    });

    it('skips dispatch when targetIndex equals sourceIndex (drop on same slot)', () => {
      const { webClient, handleDragEnd } = setupHook();
      const card = makeCard({ id: 102 });
      handleDragEnd(
        buildEvent({
          sourceCard: card,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.HAND,
          sourceIndex: 2,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.HAND,
          targetIndex: 2,
        }),
      );

      expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    });
  });

  describe('drag-drop never attaches (Cockatrice parity)', () => {
    it('dispatches moveCard, not attachCard, even when targeting a table row that contains another card', () => {
      // Card slots are no longer drop targets; drops always land on the row
      // and resolve via grid math. Attach is right-click-menu-only — see
      // cockatrice/src/game/board/card_item.cpp `drawAttachArrow`.
      const { webClient, handleDragEnd } = setupHook();
      const source = makeCard({ id: 90, x: 0, y: 0 });
      const occupant = makeCard({ id: 91, x: 0, y: 0 });
      handleDragEnd(
        buildEvent({
          sourceCard: source,
          sourcePlayerId: 1,
          sourceZone: Enriched.ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          targetRow: 0,
          rowCards: [occupant],
          pointerXInRow: 0,
        }),
      );

      expect(webClient.request.game.attachCard).not.toHaveBeenCalled();
      expect(webClient.request.game.moveCard).toHaveBeenCalledTimes(1);
      // closestGridPoint bumps to subPos 1 since base is occupied → x=1.
      expect(webClient.request.game.moveCard.mock.calls[0][1].x).toBe(1);
    });
  });
});
