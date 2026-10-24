import type { CardSource, CardSourceRecords, Token } from '../dexie/types';
import {
  emptyImportSummary,
  errorDetail,
  relativePathOf,
  type ImportFailReason,
  type ImportFileOptions,
  type ImportIssue,
  type ImportSkipReason,
  type ImportSummary,
} from '../imports';
import { cardDatabaseService, CUSTOM_TOKEN_SET, type CardDatabaseSummary, type NewSourceInput } from './CardDatabaseService';
import { MAX_IMPORT_BYTES, MAX_LOCAL_XML_BYTES } from './cardImportLimits';
import { cockatriceXmlParser } from './CockatriceXmlParser';
import { sourceIdFor, sourceKindForFile } from './mergeCardSources';

export type CardSourceFileKind = 'main' | 'tokens' | 'spoiler' | 'custom' | 'user-tokens';

export interface ScannedCardSource {
  name: string;
  path: string;
  kind: CardSourceFileKind;
  xml: string;
  records: CardSourceRecords;
}

export interface CardSourceScan {
  sources: ScannedCardSource[];
  skipped: ImportIssue<ImportSkipReason>[];
  failed: ImportIssue<ImportFailReason>[];
}

export interface CardSourceScanOptions extends ImportFileOptions {
  customSetsOnly?: boolean;
}

export interface CardSourceImportSummary extends ImportSummary {
  unknownSets: string[];
  counts: CardDatabaseSummary | null;
}

const XML_FILE = /\.xml$/i;
const BROWSER_COPY_SUFFIX = /\s\(\d+\)(?=\.xml$)/i;
const CUSTOM_TOKENS_FILE = `${CUSTOM_TOKEN_SET.name.value}.xml`.toLowerCase();

function fileKindOf(name: string, records: CardSourceRecords, customSetsOnly: boolean): CardSourceFileKind {
  const canonical = name.replace(BROWSER_COPY_SUFFIX, '');
  if (canonical.toLowerCase() === CUSTOM_TOKENS_FILE && records.tokens.length && !records.cards.length) {
    return 'user-tokens';
  }
  const kind = sourceKindForFile(canonical);
  return customSetsOnly && kind !== 'spoiler' ? 'custom' : kind;
}

function byPath(a: ScannedCardSource, b: ScannedCardSource): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

export async function scanCardSourceFiles(
  files: readonly File[],
  options: CardSourceScanOptions = {},
): Promise<CardSourceScan> {
  const scan: CardSourceScan = { sources: [], skipped: [], failed: [] };
  let totalBytes = 0;
  for (const file of files) {
    if (options.isCancelled?.()) {
      break;
    }
    const name = file.name;
    if (!XML_FILE.test(name)) {
      scan.skipped.push({ name, reason: 'unsupported' });
      continue;
    }
    totalBytes += file.size;
    if (file.size > MAX_LOCAL_XML_BYTES || totalBytes > MAX_IMPORT_BYTES) {
      scan.failed.push({ name, reason: 'too-large' });
      continue;
    }
    try {
      const xml = await file.text();
      const records = cockatriceXmlParser.parseSource(xml);
      scan.sources.push({
        name,
        path: relativePathOf(file, options),
        kind: fileKindOf(name, records, options.customSetsOnly ?? false),
        xml,
        records,
      });
    } catch (error) {
      scan.failed.push({ name, reason: 'invalid', detail: errorDetail(error) });
    }
  }
  scan.sources.sort(byPath);
  return scan;
}

function sameToken(a: Token, b: Token | undefined): boolean {
  return b !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

const CUSTOM_SETS_FOLDER = 'customsets';

export function customSetFileName(relativePath: string): string {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  const folderIndex = segments.findLastIndex((segment) => segment.toLowerCase() === CUSTOM_SETS_FOLDER);
  const inside = folderIndex >= 0 ? segments.slice(folderIndex + 1) : segments.slice(segments.length > 1 ? 1 : 0);
  return inside.join('/');
}

function storedFileNameOf(source: ScannedCardSource): string {
  return source.kind === 'custom' ? customSetFileName(source.path) : source.name;
}

function existingSourceFor(
  source: ScannedCardSource,
  stored: readonly CardSource[],
  claimed: ReadonlySet<string>,
): CardSource | undefined {
  if (source.kind === 'custom') {
    const fileName = storedFileNameOf(source).toLowerCase();
    return stored.find((s) => s.kind === 'custom' && !claimed.has(s.id) && s.fileName.toLowerCase() === fileName);
  }
  const id = sourceIdFor(source.kind, source.name, 0);
  return stored.find((s) => s.id === id && !claimed.has(s.id));
}

async function saveSourceLayers(
  sources: readonly ScannedCardSource[],
  summary: CardSourceImportSummary,
): Promise<void> {
  const stored = await cardDatabaseService.listSources();
  const claimed = new Set<string>();
  const pending: { source: ScannedCardSource; fileName: string; replacedId?: string }[] = [];
  for (const source of sources) {
    const fileName = storedFileNameOf(source);
    const existing = existingSourceFor(source, stored, claimed);
    if (existing) {
      claimed.add(existing.id);
    }
    if (existing && await cardDatabaseService.hasSourceXml(existing.id, source.xml)) {
      summary.skipped.push({ name: fileName, reason: 'duplicate' });
    } else {
      pending.push({ source, fileName, replacedId: existing?.id });
    }
  }
  if (!pending.length) {
    return;
  }
  try {
    const rebuild = await cardDatabaseService.addSources(
      pending.map(({ source, fileName, replacedId }): NewSourceInput => ({
        fileName,
        xml: source.xml,
        records: source.records,
        origin: 'file',
        kind: source.kind,
        replaces: replacedId,
      })),
    );
    summary.unknownSets = rebuild.unknownSets;
    summary.counts = rebuild.summary;
    pending.forEach(({ fileName, replacedId }) => summary.imported.push(
      replacedId ? { name: fileName, replaced: true } : { name: fileName },
    ));
  } catch (error) {
    pending.forEach(({ fileName }) => summary.failed.push({ name: fileName, reason: 'save-failed', detail: errorDetail(error) }));
  }
}

async function saveCustomTokenFiles(
  sources: readonly ScannedCardSource[],
  summary: CardSourceImportSummary,
): Promise<void> {
  for (const source of sources) {
    try {
      const current = new Map((await cardDatabaseService.getCustomTokens()).map((token) => [token.name.value, token]));
      const changed = source.records.tokens.filter((token) => !sameToken(token, current.get(token.name.value)));
      if (!changed.length) {
        summary.skipped.push({ name: source.name, reason: 'duplicate' });
        continue;
      }
      await cardDatabaseService.saveCustomTokens(changed);
      summary.imported.push(changed.some((token) => current.has(token.name.value))
        ? { name: source.name, replaced: true }
        : { name: source.name });
      summary.counts = await cardDatabaseService.summary();
    } catch (error) {
      summary.failed.push({ name: source.name, reason: 'save-failed', detail: errorDetail(error) });
    }
  }
}

export async function saveCardSourceScan(scan: CardSourceScan): Promise<CardSourceImportSummary> {
  const summary: CardSourceImportSummary = {
    ...emptyImportSummary(),
    skipped: [...scan.skipped],
    failed: [...scan.failed],
    unknownSets: [],
    counts: null,
  };
  await saveSourceLayers(scan.sources.filter((source) => source.kind !== 'user-tokens'), summary);
  await saveCustomTokenFiles(scan.sources.filter((source) => source.kind === 'user-tokens'), summary);
  return summary;
}

export async function importCustomSetFiles(
  files: readonly File[],
  options: ImportFileOptions = {},
): Promise<CardSourceImportSummary> {
  const scan = await scanCardSourceFiles(files, { ...options, customSetsOnly: true });
  if (options.isCancelled?.()) {
    return saveCardSourceScan({ sources: [], skipped: scan.skipped, failed: scan.failed });
  }
  return saveCardSourceScan(scan);
}
