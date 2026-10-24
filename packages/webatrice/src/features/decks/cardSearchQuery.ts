import { isMtgFormat, normalizeFormat } from '@app/types';

import type { ManaColor } from './manaSymbols';

export type FilterColorMode = 'includes' | 'exactly' | 'atMost' | 'withinIdentity';
export type FilterCardType =
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Planeswalker'
  | 'Land';
export type FilterRarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export interface SearchFiltersState {
  colors: ManaColor[];
  colorMode: FilterColorMode;
  types: FilterCardType[];
  subtype: string;
  showAdvanced: boolean;
  cmcMin: string;
  cmcMax: string;
  oracle: string;
  rarities: FilterRarity[];
  legalOnly?: boolean;
}

export interface SearchScope {
  identity?: readonly string[];
  format?: string;
}

export const EMPTY_FILTERS: SearchFiltersState = {
  colors: [],
  colorMode: 'includes',
  types: [],
  subtype: '',
  showAdvanced: false,
  cmcMin: '',
  cmcMax: '',
  oracle: '',
  rarities: [],
};

export const FILTER_TYPES: FilterCardType[] = [
  'Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land',
];

export const FILTER_RARITIES: FilterRarity[] = ['common', 'uncommon', 'rare', 'mythic'];

export function buildScryfallQuery(typed: string, f: SearchFiltersState, scope: SearchScope = {}): string {
  const parts: string[] = [];
  const text = typed.trim();
  if (text) {
    parts.push(text);
  }

  if (f.colorMode === 'withinIdentity' && scope.identity) {
    const letters = scope.identity.filter((c) => c !== 'C').map((c) => c.toLowerCase()).join('');
    parts.push(letters ? `id<=${letters}` : 'id:c');
  } else if (f.colors.length > 0) {
    const letters = f.colors.map((c) => c.toLowerCase()).join('');
    const op = f.colorMode === 'exactly' ? '=' : f.colorMode === 'atMost' || f.colorMode === 'withinIdentity' ? '<=' : ':';
    parts.push(`c${op}${letters}`);
  }

  if (f.types.length > 0) {
    const clauses = f.types.map((t) => `t:${t.toLowerCase()}`);
    parts.push(clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]);
  }

  // Subtype: quoted phrase → single clause; otherwise per-token AND.
  const subtype = f.subtype.trim();
  if (subtype) {
    const hasQuotes = /^".*"$/.test(subtype);
    if (hasQuotes) {
      parts.push(`t:${subtype.toLowerCase()}`);
    } else {
      const tokens = subtype.split(/\s+/).filter(Boolean);
      for (const tok of tokens) {
        parts.push(`t:${tok.toLowerCase()}`);
      }
    }
  }

  const min = f.cmcMin.trim();
  const max = f.cmcMax.trim();
  if (min && /^\d+$/.test(min)) {
    parts.push(`cmc>=${min}`);
  }
  if (max && /^\d+$/.test(max)) {
    parts.push(`cmc<=${max}`);
  }

  const oracle = f.oracle.trim();
  if (oracle) {
    const safe = oracle.replace(/"/g, '\\"');
    parts.push(`o:"${safe}"`);
  }

  // Full selection == no filter; only emit when partially narrowed.
  if (f.rarities.length > 0 && f.rarities.length < 4) {
    const clauses = f.rarities.map((r) => `r:${r}`);
    parts.push(clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]);
  }

  if (f.legalOnly && isMtgFormat(scope.format)) {
    parts.push(`f:${normalizeFormat(scope.format)}`);
  }

  return parts.join(' ');
}

export function hasActiveFilters(f: SearchFiltersState): boolean {
  return (
    f.colors.length > 0 ||
    f.types.length > 0 ||
    f.subtype.trim() !== '' ||
    f.cmcMin.trim() !== '' ||
    f.cmcMax.trim() !== '' ||
    f.oracle.trim() !== '' ||
    f.rarities.length > 0
  );
}

export function toggleFilter<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}
