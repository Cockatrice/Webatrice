import type { DeckCard, HydratedDeck } from './types';

export type DeckProvider = 'tappedout' | 'archidekt' | 'moxfield' | 'deckstats';

export interface ParsedDeckLink {
  provider: DeckProvider;
  deckId: string;
  apiUrl: string;
  handoffUrl: string;
  handoffIsText: boolean;
}

export function parseDeckUrl(url: string): ParsedDeckLink | null {
  let match = url.match(/tappedout\.net\/(?:mtg-decks\/)?([^/?#]+)/);
  if (match) {
    const slug = match[1];
    const apiUrl = `https://tappedout.net/mtg-decks/${slug}/?fmt=txt`;
    return { provider: 'tappedout', deckId: slug, apiUrl, handoffUrl: apiUrl, handoffIsText: true };
  }
  match = url.match(/archidekt\.com\/decks\/(\d+)/);
  if (match) {
    const id = match[1];
    return {
      provider: 'archidekt',
      deckId: id,
      apiUrl: `https://archidekt.com/api/decks/${id}/?format=json`,
      handoffUrl: `https://archidekt.com/decks/${id}`,
      handoffIsText: false,
    };
  }
  match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const id = match[1];
    return {
      provider: 'moxfield',
      deckId: id,
      apiUrl: `https://api.moxfield.com/v2/decks/all/${id}/`,
      handoffUrl: `https://moxfield.com/decks/${id}`,
      handoffIsText: false,
    };
  }
  match = url.match(/deckstats\.net\/decks\/(\d+\/[a-zA-Z0-9_-]+)/);
  if (match) {
    const path = match[1];
    const apiUrl = `https://deckstats.net/decks/${path}?include_comments=1&export_mtgarena=1`;
    return { provider: 'deckstats', deckId: path, apiUrl, handoffUrl: apiUrl, handoffIsText: true };
  }
  return null;
}

function zone(cards: readonly DeckCard[], category: DeckCard['category']): DeckCard[] {
  return cards.filter((c) => c.category === category);
}

export function plainDeckText(
  cards: readonly DeckCard[],
  { prefixSideboard = true, slashSplitCards = false, sectionHeaders = false }: {
    prefixSideboard?: boolean;
    slashSplitCards?: boolean;
    sectionHeaders?: boolean;
  } = {},
): string {
  const groups = sectionHeaders ? [
    { header: '// Commander', cards: cards.filter((c) => c.isCommander) },
    { header: '// Deck', cards: cards.filter((c) => c.category === 'main' && !c.isCommander) },
    { header: '// Sideboard', cards: zone(cards, 'sideboard') },
  ] : [{ header: '', cards: [...zone(cards, 'main'), ...zone(cards, 'sideboard')] }];
  return groups.filter((group) => group.cards.length > 0).map((group) => {
    const lines = group.cards.map((c) => {
      const name = slashSplitCards ? c.name.replace(/\/\//g, '/') : c.name;
      const prefix = prefixSideboard && c.category === 'sideboard' ? 'SB: ' : '';
      return `${prefix}${c.quantity} ${name}`;
    });
    return [...(group.header ? [group.header] : []), ...lines].join('\n');
  }).join(sectionHeaders ? '\n\n' : '\n') + (cards.length ? '\n' : '');
}

export type DecklistSite = 'decklist.org' | 'decklist.xyz';

function decklistLine(c: DeckCard): string {
  let line = `${c.quantity} ${c.name}`;
  if (c.set) {
    line += ` (${c.set.toUpperCase()})`;
  }
  if (c.collectorNumber) {
    line += ` ${c.collectorNumber}`;
  }
  return line;
}

export function decklistExportUrl(deck: HydratedDeck, site: DecklistSite): string | null {
  const main = zone(deck.cards, 'main').map(decklistLine).join('\n');
  const side = zone(deck.cards, 'sideboard').map(decklistLine).join('\n');
  if (!main && !side) {
    return null;
  }
  return `https://www.${site}/?deckmain=${encodeURIComponent(main)}&deckside=${encodeURIComponent(side)}`;
}

export interface FormPost {
  action: string;
  fields: Record<string, string>;
}

function knownCards(deck: HydratedDeck): DeckCard[] {
  return deck.cards.filter((c) => c.lookupSource !== 'unknown');
}

export function deckstatsAnalyzeForm(deck: HydratedDeck): FormPost {
  return {
    action: 'https://deckstats.net/index.php',
    fields: { deck: plainDeckText(knownCards(deck)), decktitle: deck.name },
  };
}

export function tappedOutAnalyzeForm(deck: HydratedDeck): FormPost {
  const plain = (category: DeckCard['category']) =>
    plainDeckText(zone(knownCards(deck), category), { prefixSideboard: false, slashSplitCards: true });
  return {
    action: 'https://tappedout.net/mtg-decks/paste/',
    fields: { name: deck.name, mainboard: plain('main'), sideboard: plain('sideboard') },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function deckPrintHtml(deck: HydratedDeck, zoneLabels: Record<DeckCard['category'], string>): string {
  const zones = (['main', 'sideboard'] as const)
    .map((category) => ({ label: zoneLabels[category], cards: zone(deck.cards, category) }))
    .filter((z) => z.cards.length > 0)
    .map((z) => [
      '<hr>',
      `<h2>${escapeHtml(z.label)}</h2>`,
      '<table>',
      ...z.cards.map((c) => `<tr><td class="n">${c.quantity}</td><td>${escapeHtml(c.name)}</td></tr>`),
      '</table>',
    ].join(''))
    .join('');
  const description = deck.meta.description ? `<p>${escapeHtml(deck.meta.description)}</p>` : '';
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${escapeHtml(deck.name)}</title>`,
    '<style>body{font-family:serif;margin:2em}h1{font-size:16pt}h2{font-size:14pt;margin:.6em 0 .2em}',
    'p{font-size:12pt}table{border-collapse:collapse;font-size:9pt}td{padding:0 .5em 0 0}td.n{text-align:right}</style>',
    '</head><body>',
    `<h1>${escapeHtml(deck.name)}</h1>`,
    description,
    zones,
    '</body></html>',
  ].join('');
}
