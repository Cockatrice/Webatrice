import type { ServerInfo_DeckStorage_Folder } from '@cockatrice/sockatrice/generated';
import type { ParsedDeck } from '@app/types';

import { allDeckFolderPaths, decksUnderFolder, joinDeckPath, MAX_DECK_PATH_LENGTH } from '../deckFolders';
import { isDeckFileName, readDeckFile } from '../deckFiles';
import type { SourceFile } from './fileSources';

export const MAX_DECK_FILE_BYTES = 0x1fffff;
export const DEFAULT_DESTINATION = 'Imported from desktop';

const CARD_DATABASE_FILES = /^(?:cards|tokens|spoiler)\.xml$/i;

export interface ClassifiedSources {
  decks: Array<SourceFile & { folder: string[] }>;
  replays: SourceFile[];
  customSets: SourceFile[];
  cardDatabase: string[];
  otherCount: number;
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function commonRoot(sources: readonly SourceFile[]): string | null {
  const firsts = new Set(sources.map((s) => {
    const segments = segmentsOf(s.path);
    return segments.length > 1 ? segments[0] : null;
  }));
  return firsts.size === 1 ? [...firsts][0] : null;
}

function indexOfSegment(segments: readonly string[], name: string): number {
  return segments.findIndex((segment) => segment.toLowerCase() === name);
}

export function classifySources(sources: readonly SourceFile[]): ClassifiedSources {
  const root = commonRoot(sources);
  const out: ClassifiedSources = { decks: [], replays: [], customSets: [], cardDatabase: [], otherCount: 0 };
  for (const source of sources) {
    const segments = segmentsOf(source.path);
    const fileName = segments[segments.length - 1] ?? source.file.name;
    const lower = fileName.toLowerCase();
    if (isDeckFileName(lower)) {
      const decksAt = indexOfSegment(segments.slice(0, -1), 'decks');
      const start = decksAt >= 0 ? decksAt + 1 : root ? 1 : 0;
      out.decks.push({ ...source, folder: segments.slice(start, -1) });
    } else if (lower.endsWith('.cor')) {
      out.replays.push(source);
    } else if (lower.endsWith('.xml')) {
      const inCustomSets = indexOfSegment(segments.slice(0, -1), 'customsets') >= 0;
      if (inCustomSets) {
        out.customSets.push(source);
      } else if (CARD_DATABASE_FILES.test(lower)) {
        out.cardDatabase.push(fileName);
      } else if (segments.length === 1 || (root && segments.length === 2)) {
        out.customSets.push(source);
      } else {
        out.otherCount += 1;
      }
    } else {
      out.otherCount += 1;
    }
  }
  return out;
}

export type DeckScanProblem = 'unreadable' | 'empty' | 'tooLarge';

export interface ScannedDeck {
  id: string;
  path: string;
  fileName: string;
  folder: string[];
  deck: ParsedDeck | null;
  ignored?: string[];
  problem?: DeckScanProblem;
}

export async function scanDeckSource(source: SourceFile & { folder: string[] }, id: string): Promise<ScannedDeck> {
  const base = { id, path: source.path, fileName: source.file.name, folder: source.folder };
  if (source.file.size > MAX_DECK_FILE_BYTES) {
    return { ...base, deck: null, problem: 'tooLarge' };
  }
  try {
    const { deck, ignored } = readDeckFile(source.file.name, await source.file.text());
    const withIgnored = ignored.length ? { ...base, ignored } : base;
    return deck.cards.length ? { ...withIgnored, deck } : { ...withIgnored, deck: null, problem: 'empty' };
  } catch {
    return { ...base, deck: null, problem: 'unreadable' };
  }
}

export type ConflictChoice = 'skip' | 'keepBoth';

export interface PlannedUpload {
  id: string;
  path: string;
  name: string;
  renamedFrom?: string;
}

export interface PlannedFolder {
  parent: string;
  name: string;
}

export interface DeckImportPlan {
  folders: PlannedFolder[];
  uploads: PlannedUpload[];
  skipped: Array<{ id: string; reason: 'exists' | 'pathTooLong' }>;
}

export function folderName(segment: string): string {
  return segment.trim().replace(/\//g, '-');
}

export function targetPathOf(destination: string, folder: readonly string[]): string {
  return [destination, ...folder].map(folderName).filter(Boolean).join('/');
}

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function uniqueName(name: string, taken: Set<string>): string {
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(nameKey(candidate))) {
      return candidate;
    }
  }
}

export function existingNameIndex(root: ServerInfo_DeckStorage_Folder | undefined): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const deck of decksUnderFolder(root, '')) {
    const names = index.get(deck.path) ?? new Set<string>();
    names.add(nameKey(deck.name));
    index.set(deck.path, names);
  }
  return index;
}

export function conflictsWithServer(
  scanned: ScannedDeck, destination: string, index: Map<string, Set<string>>,
): boolean {
  return Boolean(scanned.deck && index.get(targetPathOf(destination, scanned.folder))?.has(nameKey(scanned.deck.name)));
}

export function planDeckImport(
  scanned: readonly ScannedDeck[],
  root: ServerInfo_DeckStorage_Folder | undefined,
  { destination, choice, selected }: { destination: string; choice: ConflictChoice; selected: ReadonlySet<string> },
): DeckImportPlan {
  const existingFolders = new Set(allDeckFolderPaths(root));
  const names = existingNameIndex(root);
  const plan: DeckImportPlan = { folders: [], uploads: [], skipped: [] };
  const plannedFolders = new Set<string>();

  for (const item of scanned) {
    if (!item.deck || !selected.has(item.id)) {
      continue;
    }
    const path = targetPathOf(destination, item.folder);
    if (path.length > MAX_DECK_PATH_LENGTH) {
      plan.skipped.push({ id: item.id, reason: 'pathTooLong' });
      continue;
    }
    const taken = names.get(path) ?? new Set<string>();
    let name = item.deck.name.trim();
    let renamedFrom: string | undefined;
    if (taken.has(nameKey(name))) {
      if (choice === 'skip') {
        plan.skipped.push({ id: item.id, reason: 'exists' });
        continue;
      }
      renamedFrom = name;
      name = uniqueName(name, taken);
    }
    taken.add(nameKey(name));
    names.set(path, taken);

    const segments = path ? path.split('/') : [];
    for (let depth = 1; depth <= segments.length; depth++) {
      const folderPath = segments.slice(0, depth).join('/');
      if (!existingFolders.has(folderPath) && !plannedFolders.has(folderPath)) {
        plannedFolders.add(folderPath);
        plan.folders.push({ parent: segments.slice(0, depth - 1).join('/'), name: segments[depth - 1] });
      }
    }
    plan.uploads.push({ id: item.id, path, name, ...(renamedFrom ? { renamedFrom } : {}) });
  }
  plan.folders.sort((a, b) => joinDeckPath(a.parent, a.name).split('/').length - joinDeckPath(b.parent, b.name).split('/').length);
  return plan;
}

export function groupByFolder<T extends { folder: string[]; name: string }>(items: readonly T[]): Array<{ folder: string; decks: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.folder.join('/');
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return Array.from(groups, ([folder, decks]) => ({ folder, decks: [...decks].sort((a, b) => collator.compare(a.name, b.name)) }))
    .sort((a, b) => collator.compare(a.folder, b.folder));
}

export function groupByReason<R extends string>(items: ReadonlyArray<{ name: string; reason: R }>): Array<{ reason: R; names: string[] }> {
  const groups = new Map<R, string[]>();
  for (const item of items) {
    groups.set(item.reason, [...(groups.get(item.reason) ?? []), item.name]);
  }
  return Array.from(groups, ([reason, names]) => ({ reason, names }));
}
