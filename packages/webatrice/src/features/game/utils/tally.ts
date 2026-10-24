import type { TFunction } from 'i18next';

export type TallyType = 'none' | 'subtypes' | 'power' | 'toughness';

export const TALLY_TYPES: readonly TallyType[] = ['none', 'subtypes', 'power', 'toughness'];

export interface TallyRow {
  name: string;
  value: string;
}

export interface TallyCard {
  name: string;
  pt: string;
  faceDown: boolean;
}

function toInt(text: string | undefined): number {
  return text != null && /^\s*[+-]?\d+\s*$/.test(text) ? parseInt(text, 10) : 0;
}

function parsePT(pt: string): { power?: number; toughness?: number } {
  if (!pt) {
    return {};
  }
  if (pt.startsWith('/')) {
    return { power: toInt(pt.slice(1)) };
  }
  const parts = pt.split('/');
  return {
    power: toInt(parts[0]),
    toughness: parts.length === 2 ? toInt(parts[1]) : undefined,
  };
}

function faceSubtypes(faceType: string): string[] {
  const parts = faceType.split(' — ');
  return parts.length > 1 ? parts[1].split(' ').filter((w) => w.length > 0) : [];
}

function countSubtypes(cards: readonly TallyCard[], typeLineOf: (name: string) => string | undefined): TallyRow[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.faceDown || !card.name) {
      continue;
    }
    for (const face of (typeLineOf(card.name) ?? '').split(' // ')) {
      for (const subtype of faceSubtypes(face)) {
        counts.set(subtype, (counts.get(subtype) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => a.count - b.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ name, count }) => ({ name, value: String(count) }));
}

function total(cards: readonly TallyCard[], name: string, pick: (pt: ReturnType<typeof parsePT>) => number | undefined): TallyRow[] {
  if (!cards.some((c) => c.pt)) {
    return [];
  }
  const sum = cards.reduce((acc, c) => acc + Math.max(pick(parsePT(c.pt)) ?? 0, 0), 0);
  return [{ name, value: String(sum) }];
}

export function computeTally(
  t: TFunction,
  cards: readonly TallyCard[],
  type: TallyType,
  typeLineOf: (name: string) => string | undefined,
): TallyRow[] {
  switch (type) {
    case 'subtypes':
      return countSubtypes(cards, typeLineOf);
    case 'power':
      return total(cards, t('PlayerMenu.tallyPower'), (pt) => pt.power);
    case 'toughness':
      return total(cards, t('PlayerMenu.tallyToughness'), (pt) => pt.toughness);
    default:
      return [];
  }
}
