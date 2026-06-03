import { ZoneName } from '@cockatrice/sockatrice';
import { useMemo, useRef } from 'react';
import { shallowEqual } from 'react-redux';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useSettings } from '@app/hooks';

import { ROW_COUNT, clampRow, getStackColumn } from './gridMath';

// See .github/instructions/webatrice-game.instructions.md#battlefield-grid (stack columns) and #attachment-stack (cross-player attach).
export interface Battlefield {
  rows: ServerInfo_Card[][];
  stackColumnsByRow: (ServerInfo_Card[] | null)[][];
  rowOrder: number[];
  isInverted: boolean;
  attachmentsByParent: ReadonlyMap<number, games.AttachedChild[]>;
}

export interface UseBattlefieldArgs {
  gameId: number;
  playerId: number;
  mirrored: boolean;
}

function rowIndexFor(card: ServerInfo_Card): number {
  return clampRow(card.y ?? 0);
}

function isAttachedChild(card: ServerInfo_Card): boolean {
  return card.attachCardId != null && card.attachCardId !== -1;
}

export function useBattlefield({ gameId, playerId, mirrored }: UseBattlefieldArgs): Battlefield {
  const cards = useAppSelector((state) =>
    games.Selectors.getCards(state, gameId, playerId, ZoneName.TABLE),
  );
  const attachmentsByParent = useAppSelector((state) =>
    games.Selectors.getAttachmentsByParent(state, gameId, playerId),
  );

  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;
  const isInverted = mirrored !== invertVerticalCoordinate;

  const rawRows = useMemo<ServerInfo_Card[][]>(() => {
    const bucketed: ServerInfo_Card[][] = Array.from({ length: ROW_COUNT }, () => []);
    for (const card of cards) {
      if (isAttachedChild(card)) {
        continue;
      }
      bucketed[rowIndexFor(card)].push(card);
    }
    for (const row of bucketed) {
      row.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    }
    return bucketed;
  }, [cards]);

  // Reference-stabilize each row array so an unchanged row keeps its identity across an
  // unrelated card mutation (cards are immutable, so shallowEqual's element-wise compare
  // also implies x/y are unchanged — keeping the dnd insertion math that reads rowCards
  // correct). This keeps BattlefieldRow's droppable `data` stable when the row didn't change.
  const prevRows = useRef<ServerInfo_Card[][]>([]);
  const rows = useMemo<ServerInfo_Card[][]>(() => {
    const stabilized = rawRows.map((row, i) =>
      (shallowEqual(row, prevRows.current[i]) ? prevRows.current[i] : row));
    prevRows.current = stabilized;
    return stabilized;
  }, [rawRows]);

  // Sparse stack columns (null = placeholder spacer). See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
  const rawStackColumnsByRow = useMemo<(ServerInfo_Card[] | null)[][]>(() => {
    return rows.map((rowCards) => {
      const sparse: (ServerInfo_Card[] | null)[] = [];
      let maxCol = -1;
      for (const card of rowCards) {
        const col = getStackColumn(card.x ?? 0);
        if (!sparse[col]) {
          sparse[col] = [];
        }
        (sparse[col] as ServerInfo_Card[]).push(card);
        if (col > maxCol) {
          maxCol = col;
        }
      }
      const filled: (ServerInfo_Card[] | null)[] = [];
      for (let i = 0; i <= maxCol; i++) {
        filled[i] = sparse[i] ?? null;
      }
      return filled;
    });
  }, [rows]);

  // Reference-stabilize each column array. Tapping one creature rebuilds the column structure,
  // but unchanged columns keep their prior array identity — so memoized BattlefieldStackColumns
  // (which receive a column as `cards`) skip re-render. This is what makes Fix A's stable
  // attachmentsByParent actually translate into skipped columns.
  const prevCols = useRef<(ServerInfo_Card[] | null)[][]>([]);
  const stackColumnsByRow = useMemo<(ServerInfo_Card[] | null)[][]>(() => {
    const stabilized = rawStackColumnsByRow.map((rowCols, r) =>
      rowCols.map((col, c) => {
        if (col == null) {
          return null;
        }
        const prev = prevCols.current[r]?.[c];
        return prev != null && shallowEqual(col, prev) ? prev : col;
      }));
    prevCols.current = stabilized;
    return stabilized;
  }, [rawStackColumnsByRow]);

  const rowOrder = isInverted ? [2, 1, 0] : [0, 1, 2];

  return { rows, stackColumnsByRow, rowOrder, isInverted, attachmentsByParent };
}
