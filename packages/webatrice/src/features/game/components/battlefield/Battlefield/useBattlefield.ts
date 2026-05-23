import { useMemo } from 'react';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useSettings } from '@app/hooks';

import { MAX_SUBPOS, ROW_COUNT, clampRow } from './gridMath';

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
    games.Selectors.getCards(state, gameId, playerId, Enriched.ZoneName.TABLE),
  );
  const attachmentsByParent = useAppSelector((state) =>
    games.Selectors.getAttachmentsByParent(state, gameId, playerId),
  );

  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;
  const isInverted = mirrored !== invertVerticalCoordinate;

  const rows = useMemo<ServerInfo_Card[][]>(() => {
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

  // Sparse stack columns (null = placeholder spacer). See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
  const stackColumnsByRow = useMemo<(ServerInfo_Card[] | null)[][]>(() => {
    return rows.map((rowCards) => {
      const sparse: (ServerInfo_Card[] | null)[] = [];
      let maxCol = -1;
      for (const card of rowCards) {
        const col = Math.floor((card.x ?? 0) / MAX_SUBPOS);
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

  const rowOrder = isInverted ? [2, 1, 0] : [0, 1, 2];

  return { rows, stackColumnsByRow, rowOrder, isInverted, attachmentsByParent };
}
