import { memo, useMemo, useRef } from 'react';

import { usePreference } from '@app/hooks';

import { cx } from '@app/utils';

import { BoardCell } from '../../../hooks/useGameBoardLayout';
import PlayerBoard from '../PlayerBoard/PlayerBoard';
import type { PlayerBoardCommands } from '../PlayerBoard/playerBoard.types';
import { useGameReadOnly } from '../GameReadOnlyContext';
import { cardScaleVars, SeatCardScaleProvider } from '../CardScaleContext';
import { useGameSay } from './useGameSay';
import { useOpenDeckInEditor } from './useOpenDeckInEditor';
import { usePlayerCardCommands } from './usePlayerCardCommands';
import { usePlayerCounterCommands } from './usePlayerCounterCommands';
import { usePlayerSeatViewModel } from './usePlayerSeatViewModel';
import { usePlayerTargetCommands } from './usePlayerTargetCommands';
import { useSeatCardScale } from './useSeatCardScale';
import { usePlayerZoneCommands } from './usePlayerZoneCommands';

import './GameBoardCell.css';

const noop = () => {};
const READ_ONLY_COMMANDS: PlayerBoardCommands = {
  zone: {
    move: noop,
    moveCards: noop,
    draw: noop,
    undoDraw: noop,
    mulligan: noop,
    shuffleLibrary: noop,
    reveal: noop,
    lendLibrary: noop,
    setAlwaysRevealTopCard: noop,
    setAlwaysLookAtTopCard: noop,
  },
  card: {
    setTapped: noop,
    untapAll: noop,
    flip: noop,
    setDoesntUntap: noop,
    setAnnotation: noop,
    setPT: noop,
    clone: noop,
    createToken: async () => {},
  },
  counter: { increment: noop, set: noop, setCardCounters: noop, flipCoin: noop },
  target: { attach: noop, unattach: noop, createArrow: noop, playAndCreateArrow: noop, clearOwnArrows: noop },
};

export interface GameBoardCellProps {
  cell: BoardCell;
  /** Total seated player count. Used to decide whether opponent
   *  hand card backs render rotated 180° — flipped for 2 / 4+
   *  player layouts (opponent conceptually "across the table"),
   *  normal for 3-player (opponents on the sides, flipping looks
   *  off). */
  totalPlayers: number;
}

function GameBoardCell({ cell, totalPlayers }: GameBoardCellProps) {
  const readOnly = useGameReadOnly();
  const model = usePlayerSeatViewModel(cell, totalPlayers);
  const zone = usePlayerZoneCommands(cell.playerId);
  const card = usePlayerCardCommands(cell.playerId, cell.isLocal);
  const counter = usePlayerCounterCommands(cell.playerId);
  const target = usePlayerTargetCommands(cell.playerId);
  const onOpenDeckInEditor = useOpenDeckInEditor(cell.playerId, cell.isLocal);
  const onSay = useGameSay(cell.isLocal);
  const cellRef = useRef<HTMLDivElement>(null);
  const horizontalHand = usePreference('horizontalHand');
  const verticalHand = cell.showHand && !horizontalHand;
  const scale = useSeatCardScale(cellRef, model.zones.battlefield.cards, cell.playerId, verticalHand);
  const style = useMemo(
    () => ({ gridColumn: cell.col + 1, gridRow: cell.row + 1, ...cardScaleVars(scale) }),
    [cell.col, cell.row, scale],
  );

  const commands = useMemo(
    () => (readOnly ? READ_ONLY_COMMANDS : zone && card && counter && target ? { zone, card, counter, target } : undefined),
    [readOnly, zone, card, counter, target],
  );

  return (
    <div
      ref={cellRef}
      className={cx('game__board-cell', { 'game__board-cell--mirrored': cell.mirrored })}
      data-card-scale={scale}
      style={style}
    >
      {commands && (
        <SeatCardScaleProvider scale={scale}>
          <PlayerBoard model={model} commands={commands} onOpenDeckInEditor={onOpenDeckInEditor} onSay={onSay} />
        </SeatCardScaleProvider>
      )}
    </div>
  );
}

export default memo(GameBoardCell);
