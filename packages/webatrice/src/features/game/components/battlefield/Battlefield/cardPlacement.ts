// Which battlefield row (or the stack) a card is played to.
//
// cards.xml `<tablerow>` is authoritative. Oracle's importer assigns 0 to
// lands, 1 to other permanents, 2 to creatures and 3 to instants/sorceries.
// Without a database row, infer the same row from the type line using
// Oracle's maintype priority (including creature lands and artifact creatures).
//
// Rows here are owner-perspective visual rows (0 = top). Inverting them for a
// mirrored board is gridMath.applyInvertY's job, done once by the caller.
// Pure: no Dexie, no client.

export type TableRow = 0 | 1 | 2 | 3;

export const STACK_TABLE_ROW = 3;

export function parseTableRow(raw: string | null | undefined): number | null {
  return raw != null && /^\d+$/.test(raw) ? Number(raw) : null;
}

export function tableRowToGridY(tableRow: number): number {
  const clamped = tableRow > 2 ? 1 : tableRow;
  return Math.max(0, Math.min(2, 2 - clamped));
}

export type CardPlacement = { zone: 'stack' } | { zone: 'table'; visualY: number };

export interface PlayedCardMeta {
  pt?: string;
  cipt?: boolean;
}

export function playedCardFields(meta: PlayedCardMeta | undefined, faceDown: boolean): { pt?: string; tapped?: true } {
  if (faceDown || !meta) {
    return {};
  }
  return { ...(meta.pt && { pt: meta.pt }), ...(meta.cipt && { tapped: true as const }) };
}

export interface CardPlacementMeta {
  tableRow?: number | null;
  typeLine?: string;
}

export function resolveCardTableRow(meta: CardPlacementMeta | undefined): number {
  return meta?.tableRow ?? tableRowFromTypeLine(meta?.typeLine ?? '');
}

export function placementForCard(meta: CardPlacementMeta | undefined, faceDown = false): CardPlacement {
  const tableRow = faceDown ? 2 : resolveCardTableRow(meta);
  if (tableRow === STACK_TABLE_ROW) {
    return { zone: 'stack' };
  }
  return { zone: 'table', visualY: tableRowToGridY(tableRow) };
}

export function tableRowFromTypeLine(typeLine: string): TableRow {
  const types = new Set(typeLine.toLowerCase().split('//').flatMap((face) => face.split(/[—–]/)[0].trim().split(/\s+/)));
  if (types.has('planeswalker')) {
    return 1;
  }
  if (types.has('creature')) {
    return 2;
  }
  if (types.has('land')) {
    return 0;
  }
  if (types.has('sorcery') || types.has('instant')) {
    return 3;
  }
  return 1;
}
