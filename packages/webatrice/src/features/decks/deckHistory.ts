import type { DeckCategory } from '@app/types';

import type { HydratedDeck } from './types';

export type DeckHistoryReason =
  | { kind: 'rename'; from: string; to: string }
  | { kind: 'description'; before: number; after: number }
  | { kind: 'format'; format: string }
  | { kind: 'banner'; name: string }
  | { kind: 'bannerCleared' }
  | { kind: 'tags' }
  | { kind: 'playmat' }
  | { kind: 'addCard'; zone: DeckCategory; name: string }
  | { kind: 'adjustCard'; delta: number; name: string }
  | { kind: 'removeCard'; name: string }
  | { kind: 'moveCard'; count: number; name: string; zone: DeckCategory }
  | { kind: 'setCommander'; name: string }
  | { kind: 'unsetCommander'; name: string }
  | { kind: 'changePrinting'; name: string; set: string };

export interface DeckMemento {
  deck: HydratedDeck;
  reason: DeckHistoryReason;
  at: number;
}

export interface DeckHistory {
  undo: readonly DeckMemento[];
  redo: readonly DeckMemento[];
}

export const EMPTY_DECK_HISTORY: DeckHistory = { undo: [], redo: [] };

export const DECK_HISTORY_LIMIT = 100;

export const RENAME_COALESCE_MS = 300;
export const DESCRIPTION_COALESCE_MS = 400;

export interface RecordOptions {
  now: number;
  coalesceMs?: number;
}

export function recordDeckEdit(
  history: DeckHistory,
  before: HydratedDeck,
  reason: DeckHistoryReason,
  { now, coalesceMs }: RecordOptions,
): DeckHistory {
  const newest = history.undo[history.undo.length - 1];
  if (
    coalesceMs != null
    && newest
    && history.redo.length === 0
    && newest.reason.kind === reason.kind
    && now - newest.at <= coalesceMs
  ) {
    const merged: DeckMemento = { deck: newest.deck, reason: mergeReasons(newest.reason, reason), at: now };
    return { undo: [...history.undo.slice(0, -1), merged], redo: [] };
  }
  const undo = [...history.undo, { deck: before, reason, at: now }];
  return { undo: undo.slice(Math.max(0, undo.length - DECK_HISTORY_LIMIT)), redo: [] };
}

function mergeReasons(older: DeckHistoryReason, newer: DeckHistoryReason): DeckHistoryReason {
  if (older.kind === 'rename' && newer.kind === 'rename') {
    return { kind: 'rename', from: older.from, to: newer.to };
  }
  if (older.kind === 'description' && newer.kind === 'description') {
    return { kind: 'description', before: older.before, after: newer.after };
  }
  return newer;
}

export interface HistoryStep {
  history: DeckHistory;
  deck: HydratedDeck;
}

export function undoDeck(history: DeckHistory, current: HydratedDeck, steps = 1): HistoryStep | null {
  return move(history, current, steps, 'undo');
}

export function redoDeck(history: DeckHistory, current: HydratedDeck, steps = 1): HistoryStep | null {
  return move(history, current, steps, 'redo');
}

function move(history: DeckHistory, current: HydratedDeck, steps: number, from: 'undo' | 'redo'): HistoryStep | null {
  const to = from === 'undo' ? 'redo' : 'undo';
  let source = history[from];
  let target = history[to];
  let deck = current;
  for (let i = 0; i < steps && source.length > 0; i++) {
    const entry = source[source.length - 1];
    target = [...target, { deck, reason: entry.reason, at: entry.at }];
    source = source.slice(0, -1);
    deck = entry.deck;
  }
  if (deck === current) {
    return null;
  }
  const next: DeckHistory = from === 'undo' ? { undo: source, redo: target } : { undo: target, redo: source };
  return { history: next, deck };
}

export interface DeckHistoryRow {
  mode: 'undo' | 'redo';
  reason: DeckHistoryReason;
  steps: number;
}

export function deckHistoryRows(history: DeckHistory): { redo: DeckHistoryRow[]; undo: DeckHistoryRow[] } {
  const redo = history.redo.map((entry, i) => ({
    mode: 'redo' as const,
    reason: entry.reason,
    steps: history.redo.length - i,
  }));
  const undo = history.undo
    .map((entry, i) => ({ mode: 'undo' as const, reason: entry.reason, steps: history.undo.length - i }))
    .reverse();
  return { redo, undo };
}
