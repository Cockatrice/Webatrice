import { server } from '@cockatrice/datatrice';
import type { WebClient } from '@cockatrice/sockatrice';
import type { RootState } from '@app/store';
import { dexieService } from '../../services/dexie/DexieService';
import { recentDeckScope } from '../../services/storage/recentDecks';
import type { DeckSummary } from './deckSummary';
import type { FlatDeck } from './deckTree';

export interface CachedDeckSummary {
  scope: string;
  deckId: number;
  creationTime: number;
  summary: DeckSummary;
  document: string;
}

const revisions = new Map<string, number>();
const invalidated = new Set<string>();
const listeners = new Set<(scope: string, deckId: number) => void>();
const key = (scope: string, deckId: number) => JSON.stringify([scope, deckId]);

export function deckSummaryScope(state: RootState, client: WebClient): string | null {
  const host = recentDeckScope(client.socket?.connectedEndpoint);
  const user = server.Selectors.getUser(state)?.name;
  return server.Selectors.getIsConnected(state) && host && user ? JSON.stringify([host, user]) : null;
}

export function deckSummaryRevision(scope: string, deckId: number): number {
  return revisions.get(key(scope, deckId)) ?? 0;
}

export function onDeckSummaryInvalidated(listener: (scope: string, deckId: number) => void): void {
  listeners.add(listener);
}

export async function invalidateDeckSummary(scope: string, deckId: number): Promise<void> {
  const id = key(scope, deckId);
  revisions.set(id, deckSummaryRevision(scope, deckId) + 1);
  invalidated.add(id);
  listeners.forEach((listener) => listener(scope, deckId));
  try {
    await dexieService.deckSummaries.where('[scope+deckId]').equals([scope, deckId]).delete();
  } catch {
    return;
  }
}

export async function readDeckSummary(scope: string, deckId: number, creationTime: number): Promise<CachedDeckSummary | undefined> {
  const id = key(scope, deckId);
  if (typeof indexedDB === 'undefined' || invalidated.has(id)) {
    return undefined;
  }
  try {
    const row = await dexieService.deckSummaries.where('[scope+deckId]').equals([scope, deckId])
      .filter((entry) => entry.creationTime === creationTime).first();
    return invalidated.has(id) ? undefined : row;
  } catch {
    return undefined;
  }
}

export function readDeckSummaries(scope: string, decks: FlatDeck[]): Promise<CachedDeckSummary[]> | undefined {
  if (typeof indexedDB === 'undefined') {
    return undefined;
  }
  return (async () => {
    try {
      const table = dexieService.deckSummaries;
      const rows: CachedDeckSummary[] = await table.where('scope').equals(scope).toArray();
      const listed = new Map(decks.map((deck) => [deck.id, deck.creationTime]));
      const removed = rows.filter((row) => listed.get(row.deckId) !== row.creationTime);
      await table.bulkDelete(removed.map((row) => [scope, row.deckId, row.creationTime]));
      return rows.filter((row) => listed.get(row.deckId) === row.creationTime && !invalidated.has(key(scope, row.deckId)));
    } catch {
      return [];
    }
  })();
}

export async function writeDeckSummary(row: CachedDeckSummary, revision: number): Promise<void> {
  if (deckSummaryRevision(row.scope, row.deckId) !== revision) {
    return;
  }
  try {
    await dexieService.deckSummaries.put(row);
    if (deckSummaryRevision(row.scope, row.deckId) === revision) {
      invalidated.delete(key(row.scope, row.deckId));
    }
  } catch {
    return;
  }
}
