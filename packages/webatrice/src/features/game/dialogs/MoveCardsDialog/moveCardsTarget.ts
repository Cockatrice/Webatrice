import { tableRowToGridY } from '../../components/battlefield/Battlefield/cardPlacement';
import { applyInvertY } from '../../components/battlefield/Battlefield/gridMath';
import type { BattlefieldGeometry } from '../../components/ui/BattlefieldGeometryContext';
import { seatDragOwner, type SeatDragSource, type SeatDropTarget } from '../../hooks/seatDropPlan';

export type MoveDestination =
  | { zone: 'battlefield'; playerId: number }
  | { zone: 'hand' | 'stack' | 'library' | 'graveyard' | 'exile' };

export interface MoveBoard {
  players: readonly { playerId: number; name: string }[];
  handOrder: readonly string[];
  stackSize: number;
  deckSize: number;
  geometry: (playerId: number) => BattlefieldGeometry;
}

export function moveDestinations(
  source: SeatDragSource,
  players: MoveBoard['players'],
  { judge = false }: { judge?: boolean } = {},
): MoveDestination[] {
  const owner = source.lenderPlayerId != null ? source.seatPlayerId : seatDragOwner(source);
  const battlefields: MoveDestination[] = [...players]
    .sort((a, b) => Number(b.playerId === owner) - Number(a.playerId === owner))
    .filter((p) => source.lenderPlayerId == null || judge || p.playerId === source.seatPlayerId)
    .map((p) => ({ zone: 'battlefield', playerId: p.playerId }));
  if (source.lenderPlayerId != null) {
    return battlefields;
  }
  const zones: MoveDestination['zone'][] = ['hand', 'stack', 'library', 'graveyard', 'exile'];
  const reorderable = new Set<string>(['hand', 'library', 'battlefield']);
  return [
    ...battlefields,
    ...zones.filter((zone) => zone !== source.zone || reorderable.has(zone)).map((zone) => ({ zone }) as MoveDestination),
  ];
}

export function battlefieldRows(inverted: boolean): { kind: 'lands' | 'creatures' | 'other'; row: number }[] {
  return ([['lands', 0], ['creatures', 1], ['other', 2]] as const).map(([kind, tableRow]) => ({
    kind,
    row: applyInvertY(tableRowToGridY(tableRow), inverted),
  }));
}

export function positionCount(destination: MoveDestination, source: SeatDragSource, board: MoveBoard, row: number): number {
  const staying = (size: number) => Math.max(0, size - (source.zone === destination.zone ? source.cards.length : 0));
  switch (destination.zone) {
    case 'battlefield':
      return board.geometry(destination.playerId).colsByWireRow[row] ?? 0;
    case 'hand':
      return staying(board.handOrder.length) + 1;
    case 'stack':
      return staying(board.stackSize) + 1;
    case 'library':
      return staying(board.deckSize) + 1;
    default:
      return 0;
  }
}

export function moveTarget(
  destination: MoveDestination,
  board: MoveBoard,
  { position, row }: { position: number; row: number },
): SeatDropTarget {
  const index = Math.max(0, position - 1);
  switch (destination.zone) {
    case 'battlefield': {
      const { rows, cols } = board.geometry(destination.playerId);
      return { zone: 'battlefield', playerId: destination.playerId, slot: { row, col: index }, grid: { rows, cols } };
    }
    case 'hand':
      return { zone: 'hand', index, order: board.handOrder };
    case 'stack':
      return { zone: 'stack', index };
    case 'library':
      return { zone: 'library', position: index };
    default:
      return { zone: destination.zone };
  }
}
