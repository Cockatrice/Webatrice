import {
  LEGACY_SOURCE_ID,
  USER_TOKENS_SOURCE_ID,
  type Card,
  type CardInSet,
  type CardSource,
  type CardSourceKind,
  type CardSourceRecords,
  type Format,
  type Set,
  type Token,
} from '../dexie/types';

export const CardSourceId = {
  MAIN: 'main',
  TOKENS: 'tokens',
  SPOILER: 'spoiler',
  USER_TOKENS: USER_TOKENS_SOURCE_ID,
  LEGACY: LEGACY_SOURCE_ID,
} as const;

export function sourceKindForFile(fileName: string): Exclude<CardSourceKind, 'user-tokens' | 'legacy'> {
  switch (fileName.toLowerCase()) {
    case 'cards.xml': return 'main';
    case 'tokens.xml': return 'tokens';
    case 'spoiler.xml': return 'spoiler';
    default: return 'custom';
  }
}

export function sourceIdFor(kind: CardSourceKind, fileName: string, order: number): string {
  switch (kind) {
    case 'main': return CardSourceId.MAIN;
    case 'tokens': return CardSourceId.TOKENS;
    case 'spoiler': return CardSourceId.SPOILER;
    case 'user-tokens': return CardSourceId.USER_TOKENS;
    case 'legacy': return CardSourceId.LEGACY;
    case 'custom': return `custom:${String(order).padStart(2, '0')}:${fileName}`;
  }
}

const KIND_RANK: Record<CardSourceKind, number> = {
  main: 0,
  tokens: 1,
  spoiler: 2,
  legacy: 3,
  custom: 4,
  'user-tokens': 5,
};

export function sortSourcesByLoadOrder<T extends Pick<CardSource, 'kind' | 'order' | 'fileName'>>(sources: readonly T[]): T[] {
  return [...sources].sort(
    (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]
      || a.order - b.order
      || a.fileName.localeCompare(b.fileName),
  );
}

export function nextCustomOrder(sources: readonly Pick<CardSource, 'kind' | 'order'>[]): number {
  return sources.filter((s) => s.kind === 'custom').reduce((max, s) => Math.max(max, s.order), 0) + 1;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function samePrinting(a: CardInSet, b: CardInSet): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

function mergeByName<T extends Card | Token>(target: Map<string, T>, records: readonly T[]): void {
  for (const record of records) {
    const name = record.name?.value;
    if (!name) {
      continue;
    }
    const existing = target.get(name);
    if (!existing) {
      target.set(name, record);
      continue;
    }
    const printings = asArray(existing.set);
    const added: CardInSet[] = [];
    for (const printing of asArray(record.set)) {
      if (![...printings, ...added].some(existing => samePrinting(printing, existing))) {
        added.push(printing);
      }
    }
    if (added.length) {
      target.set(name, { ...existing, set: [...printings, ...added] });
    }
  }
}

export function mergeCardSources(layers: readonly CardSourceRecords[]): CardSourceRecords {
  const records = new Map<string, Card | Token>();
  const tokenNames = new globalThis.Set<string>();
  const sets = new Map<string, Set>();
  const formats = new Map<string, Format>();
  let info: CardSourceRecords['info'];

  for (const layer of layers) {
    mergeByName(records, layer.cards);
    for (const token of layer.tokens) {
      if (!records.has(token.name.value)) {
        tokenNames.add(token.name.value);
      }
      mergeByName(records, [token]);
    }
    for (const set of layer.sets) {
      const code = set.name?.value;
      if (code && !sets.has(code)) {
        sets.set(code, set);
      }
    }
    for (const format of layer.formats) {
      formats.set(format.formatName.toLowerCase(), format);
    }
    info ??= layer.info;
  }

  for (const record of records.values()) {
    for (const printing of asArray(record.set)) {
      if (printing.value && !sets.has(printing.value)) {
        sets.set(printing.value, { name: { value: printing.value } });
      }
    }
  }

  return {
    cards: [...records.values()].filter(record => !tokenNames.has(record.name.value)) as Card[],
    sets: [...sets.values()],
    tokens: [...records.values()].filter(record => tokenNames.has(record.name.value)),
    formats: [...formats.values()],
    info,
  };
}
