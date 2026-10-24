import { defaultMeta, parseCod, zoneXml } from '@app/services';
import type { ParsedDeck } from '@app/types';

import {
  inferDeckFormat,
  parseDecklist,
  promoteSideboardCommanders,
  type ExtraZone,
  type ParsedEntry,
  type ParseResult,
} from './decklistParser';

export const DECK_FILE_EXTENSIONS = ['.cod', '.txt', '.dec', '.dek', '.mwdeck'] as const;
export const DECK_FILE_ACCEPT = DECK_FILE_EXTENSIONS.join(',');

export type DeckFileParse =
  | { kind: 'cod'; deck: ParsedDeck }
  | { kind: 'list'; list: ParseResult };

export function isDeckFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return DECK_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function deckFileBaseName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function parseMtgoDek(xml: string): ParseResult | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement?.tagName !== 'Deck') {
    return null;
  }
  const entries: ParsedEntry[] = [];
  for (const el of Array.from(doc.documentElement.children).filter((c) => c.tagName === 'Cards')) {
    const quantity = parseInt(el.getAttribute('Quantity') ?? '', 10);
    const name = el.getAttribute('Name')?.trim();
    if (!name || !Number.isFinite(quantity) || quantity < 1) {
      continue;
    }
    entries.push({ quantity, name, category: el.getAttribute('Sideboard') === 'true' ? 'sideboard' : 'main' });
  }
  return { entries, ignored: [] };
}

export function parseDeckFile(fileName: string, text: string): DeckFileParse {
  const body = text.replace(/^\uFEFF/, '');
  const trimmed = body.trimStart();
  if (trimmed.startsWith('<')) {
    if (trimmed.includes('<cockatrice_deck')) {
      try {
        return { kind: 'cod', deck: parseCod(body) };
      } catch {
        return { kind: 'list', list: parseDecklist(body) };
      }
    }
    const dek = parseMtgoDek(body);
    if (dek) {
      return { kind: 'list', list: dek };
    }
  }
  return { kind: 'list', list: parseDecklist(body) };
}

export function listDeckCards(list: ParseResult): ParsedEntry[] {
  return promoteSideboardCommanders(list.entries);
}

export function extraZonesFromEntries(entries: readonly ParsedEntry[]): string[] {
  const zones = new Map<ExtraZone, ParsedEntry[]>();
  for (const entry of entries) {
    if (entry.extraZone) {
      zones.set(entry.extraZone, [...(zones.get(entry.extraZone) ?? []), entry]);
    }
  }
  return Array.from(zones, ([zone, cards]) => zoneXml(zone, cards));
}

export function listToParsedDeck(list: ParseResult, fallbackName: string): ParsedDeck {
  const entries = listDeckCards(list);
  const cards = entries.filter((entry) => !entry.extraZone).map(({ extraZone: _zone, ...card }) => card);
  const extraZonesXml = extraZonesFromEntries(entries);
  return {
    name: list.name || fallbackName,
    meta: list.description ? { ...defaultMeta(), description: list.description } : defaultMeta(),
    cards,
    format: inferDeckFormat(entries),
    ...(extraZonesXml.length ? { extraZonesXml } : {}),
  };
}

function hasDeckName(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
  const el = Array.from(doc.documentElement?.children ?? []).find((child) => child.tagName === 'deckname');
  return Boolean(el?.textContent?.trim());
}

export interface DeckFileRead {
  deck: ParsedDeck;
  ignored: string[];
}

export function readDeckFile(fileName: string, text: string): DeckFileRead {
  const parsed = parseDeckFile(fileName, text);
  if (parsed.kind === 'cod') {
    const deck = parsed.deck;
    const named = hasDeckName(text) ? deck : { ...deck, name: deckFileBaseName(fileName) };
    return { deck: named.format.trim() ? named : { ...named, format: inferDeckFormat(named.cards) }, ignored: [] };
  }
  return { deck: listToParsedDeck(parsed.list, deckFileBaseName(fileName)), ignored: parsed.list.ignored };
}

export function extraZoneSummary(extraZonesXml: readonly string[] | undefined): Array<{ zone: string; count: number }> {
  return (extraZonesXml ?? []).map((xml) => {
    const zone = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    const count = Array.from(zone.getElementsByTagName('card'))
      .reduce((sum, card) => sum + (parseInt(card.getAttribute('number') || '1', 10) || 0), 0);
    return { zone: zone.getAttribute('name') ?? '', count };
  });
}
