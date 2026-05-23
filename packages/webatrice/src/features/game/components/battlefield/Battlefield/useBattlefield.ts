import { useMemo } from 'react';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useSettings } from '@app/hooks';

import { MAX_SUBPOS, ROW_COUNT, clampRow } from './gridMath';

export interface Battlefield {
  // Flat rows (preserved for drop-handler occupancy and legacy consumers).
  rows: ServerInfo_Card[][];
  // Row → stack columns → ≤ MAX_SUBPOS cards sorted by sub-position
  // (x mod MAX_SUBPOS). Empty stack columns are preserved as `null` so a
  // card stored at x=9 (stack col 3) renders at visual column 3, not visual
  // column 0 — matching desktop's ability to hold mid-lane positions.
  stackColumnsByRow: (ServerInfo_Card[] | null)[][];
  rowOrder: number[];
  isInverted: boolean;
  // Attachments parented to this player's TABLE cards. Children may live in
  // a different player's zone (cross-player attach) — `games.AttachedChild` carries
  // the child's actual owner so handlers wire to the right player.
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
  // Mirrors desktop TableZone::isInverted() — XOR of per-player mirrored and
  // the global invertVerticalCoordinate preference.
  const isInverted = mirrored !== invertVerticalCoordinate;

  const rows = useMemo<ServerInfo_Card[][]>(() => {
    const bucketed: ServerInfo_Card[][] = Array.from({ length: ROW_COUNT }, () => []);
    for (const card of cards) {
      // Children render nested under their parent via AttachmentStack, not as
      // their own lane slot.
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

  // Group each row's cards by stack column = floor(x / MAX_SUBPOS). Desktop
  // packs up to MAX_SUBPOS cards into a stack at sub-positions 0/1/2; the
  // renderer absolutely-positions each card at left = subPos * offset.
  //
  // Empty columns are preserved as `null` entries in the dense-indexed array
  // so the renderer can emit a placeholder spacer for each gap — otherwise a
  // card dropped at gridX=9 (stack col 3) in an empty row would render at
  // visual column 0, breaking WYSIWYG drop positioning.
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
