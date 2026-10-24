import type { DeckRowDensity } from './deckEditorLayout';

export const DECK_COLUMN_GAP = 24;
export const DECK_COLUMN_MIN_WIDTH: Record<DeckRowDensity, number> = { comfortable: 250, compact: 220 };
export const DECK_COLUMN_MAX_WIDTH = 460;
const HEADER_WEIGHT = 2;

export function deckColumnCount(width: number, density: DeckRowDensity, groupCount: number): number {
  if (groupCount <= 0) {
    return 1;
  }
  const fit = Math.floor((width + DECK_COLUMN_GAP) / (DECK_COLUMN_MIN_WIDTH[density] + DECK_COLUMN_GAP));
  return Math.max(1, Math.min(groupCount, fit));
}

export function deckGroupWeight(rows: number, collapsed: boolean): number {
  return collapsed ? HEADER_WEIGHT : HEADER_WEIGHT + rows;
}

export function partitionIntoColumns(weights: readonly number[], columns: number): number[][] {
  const n = weights.length;
  const k = Math.max(1, Math.min(columns, n));
  if (n === 0) {
    return [];
  }
  const prefix = [0];
  for (const w of weights) {
    prefix.push(prefix[prefix.length - 1] + w);
  }
  const span = (from: number, to: number) => prefix[to] - prefix[from];
  const best: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(0));
  best[0][0] = 0;
  for (let c = 1; c <= k; c++) {
    for (let end = c; end <= n; end++) {
      for (let start = c - 1; start < end; start++) {
        const cost = Math.max(best[c - 1][start], span(start, end));
        if (cost <= best[c][end]) {
          best[c][end] = cost;
          cut[c][end] = start;
        }
      }
    }
  }
  const result: number[][] = [];
  let end = n;
  for (let c = k; c >= 1; c--) {
    const start = cut[c][end];
    result.unshift(Array.from({ length: end - start }, (_, i) => start + i));
    end = start;
  }
  return result;
}

export interface DeckColumnGroup {
  rows: number;
  collapsed: boolean;
}

export interface DeckColumnLayout {
  count: number;
  breaks: ReadonlySet<number>;
  maxWidth: number;
}

export function deckColumnLayout(width: number, density: DeckRowDensity, groups: readonly DeckColumnGroup[]): DeckColumnLayout {
  const count = deckColumnCount(width, density, groups.length);
  const columns = partitionIntoColumns(groups.map(({ rows, collapsed }) => deckGroupWeight(rows, collapsed)), count);
  return {
    count: Math.max(1, columns.length),
    breaks: new Set(columns.slice(1).map((column) => column[0])),
    maxWidth: count * DECK_COLUMN_MAX_WIDTH + (count - 1) * DECK_COLUMN_GAP,
  };
}
