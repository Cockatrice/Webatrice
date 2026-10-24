import type { Card } from './Card';
import type { Format } from './Format';
import type { Info } from './Info';
import type { Set } from './Set';
import type { Token } from './Token';

export type CardSourceKind = 'main' | 'tokens' | 'spoiler' | 'custom' | 'user-tokens' | 'legacy';

export const LEGACY_SOURCE_ID = 'legacy';

export const USER_TOKENS_SOURCE_ID = 'user-tokens';

export type CardSourceOrigin = 'file' | 'url' | 'editor' | 'migration';

export interface CardSourceRecords {
  cards: Card[];
  sets: Set[];
  tokens: Token[];
  formats: Format[];
  info?: Info;
}

export interface CardSourceCounts {
  cards: number;
  sets: number;
  tokens: number;
  formats: number;
}

export class CardSource {
  id: string;
  kind: CardSourceKind;
  fileName: string;
  origin: CardSourceOrigin;
  url?: string;
  order: number;
  importedAt: string;
  counts: CardSourceCounts;
  sourceVersion?: string;
  author?: string;
  createdAt?: string;
}

export interface CardSourcePayload {
  id: string;
  xml?: string;
  records?: CardSourceRecords;
}
