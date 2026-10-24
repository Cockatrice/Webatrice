import { ZoneName } from '@cockatrice/sockatrice';
import type { MoveCardParams } from '@cockatrice/sockatrice/generated';

import type { Coordinates, PointerGestureData } from './gamePointerSensor';
import { planHandReorder, planPositionalReorder } from './handReorder';

export type FixedSeatZone = 'hand' | 'battlefield' | 'library' | 'graveyard' | 'exile' | 'stack' | 'sideboard';
export type SeatZone = FixedSeatZone | { kind: 'custom'; name: string };

export interface SeatSlot {
  row: number;
  col: number;
}

export interface SeatDragCard {
  id: string;
  slot?: SeatSlot;
  ownerPlayerId?: number;
  printedPT?: string;
}

export interface SeatDragSource extends PointerGestureData {
  kind: 'seat';
  seatPlayerId: number;
  zone: SeatZone;
  cards: readonly SeatDragCard[];
  lenderPlayerId?: number;
}

export type SeatDropTarget =
  | { zone: 'battlefield'; playerId: number; slot: SeatSlot; grid: { rows: number; cols: number } }
  | { zone: 'hand'; index: number; order?: readonly string[] }
  | { zone: 'stack'; index: number }
  | { zone: 'library'; position?: number }
  | { zone: 'graveyard' | 'exile' | 'sideboard' };

export interface SeatDropPoint {
  pointer: Coordinates;
  cardOrigin: Coordinates;
}

export interface SeatDropZone {
  kind: 'seat-drop';
  seatPlayerId: number;
  acceptsOtherSeats?: boolean;
  priority: number;
  resolve: (drop: SeatDropPoint, source: SeatDragSource) => SeatDropTarget | null;
}

export const SEAT_DROP_PRIORITY = {
  librarySearchDialog: 100,
  pileViewDialog: 90,
  sideboardDialog: 80,
  revealDialog: 70,
  battlefield: 50,
  stack: 40,
  hand: 30,
  library: 20,
  graveyard: 10,
  exile: 5,
} as const;

export function isSeatDragSource(data: unknown): data is SeatDragSource {
  return (data as SeatDragSource | undefined)?.kind === 'seat';
}

export function isSeatDropZone(data: unknown): data is SeatDropZone {
  return (data as SeatDropZone | undefined)?.kind === 'seat-drop';
}

export function seatDragOwner(source: SeatDragSource): number {
  return source.cards[0]?.ownerPlayerId ?? source.seatPlayerId;
}

export function seatDropAccepts(zone: SeatDropZone, source: SeatDragSource): boolean {
  return zone.acceptsOtherSeats === true || zone.seatPlayerId === seatDragOwner(source);
}

const WIRE_ZONE: Record<FixedSeatZone, (typeof ZoneName)[keyof typeof ZoneName]> = {
  battlefield: ZoneName.TABLE,
  hand: ZoneName.HAND,
  library: ZoneName.DECK,
  graveyard: ZoneName.GRAVE,
  exile: ZoneName.EXILE,
  stack: ZoneName.STACK,
  sideboard: ZoneName.SIDEBOARD,
};

export function seatZoneName(zone: SeatZone): string {
  return typeof zone === 'string' ? WIRE_ZONE[zone] : zone.name;
}

export function intendedBattlefieldSlots(
  cards: readonly SeatDragCard[],
  start: SeatSlot,
  grid: { rows: number; cols: number },
): SeatSlot[] {
  if (cards.length === 0) {
    return [];
  }
  const rows = Math.max(1, grid.rows);
  const cols = Math.max(1, grid.cols);
  const sourceSlots = cards.map((c) => c.slot);
  if (sourceSlots.every((s): s is SeatSlot => s !== undefined)) {
    const first = sourceSlots[0];
    if (sourceSlots.every((s) => s.row === first.row && s.col === first.col)) {
      return cards.map(() => start);
    }
    const minRow = Math.min(...sourceSlots.map((s) => s.row));
    const minCol = Math.min(...sourceSlots.map((s) => s.col));
    return sourceSlots.map((s) => ({
      row: Math.max(0, Math.min(rows - 1, start.row + (s.row - minRow))),
      col: Math.max(0, Math.min(cols - 1, start.col + (s.col - minCol))),
    }));
  }
  const out: SeatSlot[] = [];
  let index = start.row * cols + start.col;
  for (let i = 0; i < cards.length; i++, index++) {
    const wrapped = index % (cols * rows);
    out.push({ row: Math.floor(wrapped / cols), col: wrapped % cols });
  }
  return out;
}

export interface SeatMoveOptions {
  judge?: boolean;
}

export function planSeatMove(source: SeatDragSource, target: SeatDropTarget, options: SeatMoveOptions = {}): MoveCardParams[] {
  const seat = source.seatPlayerId;
  const owner = seatDragOwner(source);
  if (source.cards.length === 0) {
    return [];
  }
  if (source.lenderPlayerId != null
    && (target.zone !== 'battlefield' || (target.playerId !== seat && !options.judge))) {
    return [];
  }

  if (target.zone === 'battlefield' && source.zone === 'battlefield' && target.playerId === seat && owner === seat) {
    const slots = intendedBattlefieldSlots(source.cards, target.slot, target.grid);
    return source.cards.flatMap((card, i) => {
      const cardId = Number(card.id);
      if (!Number.isFinite(cardId)) {
        return [];
      }
      const slot = slots[i] ?? target.slot;
      return [{
        startPlayerId: seat,
        startZone: ZoneName.TABLE,
        cardsToMove: { card: [{ cardId }] },
        targetPlayerId: seat,
        targetZone: ZoneName.TABLE,
        x: slot.col * 3,
        y: slot.row,
      } as MoveCardParams];
    });
  }

  if (target.zone === 'hand' && source.zone === 'hand' && target.order) {
    return planHandReorder(target.order, source.cards.map((card) => card.id), target.index).flatMap(({ cardId, x }) => {
      const id = Number(cardId);
      if (!Number.isFinite(id)) {
        return [];
      }
      return [{
        startPlayerId: seat,
        startZone: ZoneName.HAND,
        cardsToMove: { card: [{ cardId: id }] },
        targetPlayerId: seat,
        targetZone: ZoneName.HAND,
        x,
        y: 0,
        isReversed: false,
      } as MoveCardParams];
    });
  }

  if (source.zone === 'library' && target.zone === 'library' && target.position !== undefined) {
    const positions = source.cards.map((card) => Number(card.id));
    if (positions.some((p) => !Number.isFinite(p))) {
      return [];
    }
    return planPositionalReorder(positions, target.position).map(({ cardId, x }) => ({
      startPlayerId: owner,
      startZone: ZoneName.DECK,
      cardsToMove: { card: [{ cardId }] },
      targetPlayerId: owner,
      targetZone: ZoneName.DECK,
      x,
      y: 0,
      isReversed: false,
    } as MoveCardParams));
  }

  const reorderable = target.zone === 'hand' || target.zone === 'battlefield';
  if (target.zone === source.zone && !reorderable) {
    return [];
  }

  const hiddenSource = source.zone === 'library' || source.zone === 'sideboard';
  const cardIds = source.cards.map((card) => {
    const id = Number(card.id);
    return Number.isFinite(id) ? id : hiddenSource ? 0 : null;
  });
  if (cardIds.some((id) => id === null)) {
    return [];
  }

  const x = (() => {
    switch (target.zone) {
      case 'battlefield':
        return target.slot.col * 3;
      case 'hand':
      case 'stack':
        return target.index;
      case 'sideboard':
        return -1;
      case 'library':
        return target.position ?? 0;
      default:
        return 0;
    }
  })();

  const entersBattlefield = target.zone === 'battlefield' && source.zone !== 'battlefield';
  return [{
    startPlayerId: source.lenderPlayerId ?? owner,
    startZone: seatZoneName(source.zone),
    cardsToMove: {
      card: cardIds.map((cardId, i) => {
        const pt = entersBattlefield ? source.cards[i].printedPT : undefined;
        return { cardId: cardId as number, ...(pt && { pt }) };
      }),
    },
    targetPlayerId: target.zone === 'battlefield' ? target.playerId : owner,
    targetZone: WIRE_ZONE[target.zone],
    x,
    y: target.zone === 'battlefield' ? target.slot.row : 0,
    isReversed: false,
  } as MoveCardParams];
}
