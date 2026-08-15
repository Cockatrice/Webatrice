import type {
  BracketAssessment,
  BracketAssessmentCombo,
  DeckCard,
  DeckCategory,
  DeckMeta,
  ParsedCard,
  ParsedDeck,
} from './types';
import { defaultMeta, parseMeta, serializeMeta, touchMeta } from './meta';

/**
 * Parser + serializer for Cockatrice `.cod` deck XML.
 *
 * Format (Cockatrice desktop compatibility):
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <cockatrice_deck version="1">
 *     <deckname>My Deck</deckname>
 *     <comments>{JSON metadata blob}</comments>
 *     <zone name="main">
 *       <card number="4" name="Sol Ring" />
 *       <card number="1" name="Lightning Bolt" set="M11" num="149" uuid="abc-123" />
 *     </zone>
 *     <zone name="side">
 *       <card number="1" name="Naturalize" />
 *     </zone>
 *   </cockatrice_deck>
 *
 * Reads two `<card>` forms — both attribute (`name="X"`) and text
 * (`<card>X</card>`) — because both appear in the wild. Writes only
 * the attribute form for consistency.
 *
 * `set`/`num`/`uuid` on `<card>` are non-standard webatrice printing
 * hints. Cockatrice desktop ignores unknown attributes; other clients
 * that don't understand them will just use the default printing.
 *
 * Zone names Cockatrice supports: "main", "side" — the only two
 * server-side setupZones() reads. Any other zone name (legacy or
 * third-party) is silently coerced to "main" on read so imported
 * decks retain every card. Webatrice does not model a commander
 * zone; commander cards live in main like every other card.
 */

/** Parse a `.cod` XML string into a structured `ParsedDeck`. Throws
 *  when the XML is malformed or missing the root element. */
export function parseCod(xml: string): ParsedDeck {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  if (dom.querySelector('parsererror')) {
    throw new Error('Cockatrice deck XML is malformed');
  }
  const root = dom.documentElement;
  if (!root || root.tagName !== 'cockatrice_deck') {
    throw new Error('Cockatrice deck XML must have a <cockatrice_deck> root');
  }

  const name = firstChildText(root, 'deckname')?.trim() || 'Untitled Deck';
  const commentsText = firstChildText(root, 'comments');
  const meta = parseMeta(commentsText);
  const format = (firstChildText(root, 'format') ?? '').trim();
  const bannerCard = firstChildText(root, 'bannerCard')?.trim() || undefined;
  const lastLoadedTimestamp = firstChildText(root, 'lastLoadedTimestamp')?.trim() || undefined;
  // Preserve the entire <tags> element as an XML string. Cockatrice
  // desktop writes it and may put arbitrary children inside; we don't
  // read the contents but round-trip them verbatim.
  const tagsEl = directChildren(root, 'tags')[0];
  const tagsXml = tagsEl ? new XMLSerializer().serializeToString(tagsEl) : undefined;

  const bracketAssessment = readBracketAssessment(root);

  const cards: ParsedCard[] = [];
  for (const zone of directChildren(root, 'zone')) {
    const zoneName = zone.getAttribute('name');
    const category = zoneNameToCategory(zoneName);
    const isCommanderZone = zoneName?.toLowerCase() === 'commander';
    for (const cardEl of directChildren(zone, 'card')) {
      const parsed = readCardElement(cardEl, category, isCommanderZone);
      if (parsed) cards.push(parsed);
    }
  }

  return {
    name,
    meta,
    cards,
    format,
    bannerCard,
    lastLoadedTimestamp,
    tagsXml,
    bracketAssessment,
  };
}

/**
 * Serialize a hydrated deck back to `.cod` XML. Auto-bumps
 * `meta.updatedAt` to now so callers don't have to. If a card has any
 * printing hints (set/num/scryfallId), they're emitted as attributes
 * on the `<card>` element. Cards are grouped into a single `<zone>`
 * per category — Cockatrice tolerates multiple zones with the same
 * name, but grouping keeps the file smaller and diff-friendly.
 */
export function serializeCod(deck: {
  name: string;
  meta: DeckMeta;
  cards: DeckCard[];
  format?: string;
  bannerCard?: string;
  lastLoadedTimestamp?: string;
  tagsXml?: string;
  bracketAssessment?: BracketAssessment;
}): string {
  const bumped = touchMeta(deck.meta);

  const doc = document.implementation.createDocument(null, 'cockatrice_deck', null);
  const root = doc.documentElement;
  root.setAttribute('version', '1');

  // Element order matches Cockatrice desktop verbatim so diffs stay
  // minimal on round-trip:
  //   lastLoadedTimestamp → deckname → format → bannerCard →
  //   comments → tags → zones
  if (deck.lastLoadedTimestamp && deck.lastLoadedTimestamp.trim()) {
    appendTextElement(doc, root, 'lastLoadedTimestamp', deck.lastLoadedTimestamp.trim());
  }
  appendTextElement(doc, root, 'deckname', deck.name || 'Untitled Deck');
  if (deck.format && deck.format.trim()) {
    appendTextElement(doc, root, 'format', deck.format.trim());
  }
  if (deck.bannerCard && deck.bannerCard.trim()) {
    appendTextElement(doc, root, 'bannerCard', deck.bannerCard.trim());
  }
  appendTextElement(doc, root, 'comments', serializeMeta(bumped));
  // <tags> is preserved opaquely — we parse the stored XML string back
  // into an Element in its own document, then adopt it into ours. Any
  // children Cockatrice desktop wrote (empty container or otherwise)
  // pass through unchanged.
  if (deck.tagsXml && deck.tagsXml.trim()) {
    const fragmentDoc = new DOMParser().parseFromString(deck.tagsXml, 'application/xml');
    const tagsEl = fragmentDoc.documentElement;
    if (tagsEl && tagsEl.tagName === 'tags' && !fragmentDoc.querySelector('parsererror')) {
      root.appendChild(doc.importNode(tagsEl, true));
    }
  }

  // Webatrice extension: cached bracket assessment with flagged cards.
  // Cockatrice desktop safely ignores unknown elements, so this
  // round-trips through the desktop client unchanged.
  if (deck.bracketAssessment) {
    root.appendChild(writeBracketAssessment(doc, deck.bracketAssessment));
  }

  // Zone layout — matches Cockatrice desktop exactly: main + side
  // are the only zones Servatrice's setupZones reads
  // (libcockatrice_deck_list only defines DECK_ZONE_MAIN /
  // _SIDE / _TOKENS). Any other zone name would be silently
  // dropped from the game library at start.
  const byCategory: Record<DeckCategory, DeckCard[]> = {
    main: [],
    sideboard: [],
  };
  for (const card of deck.cards) {
    byCategory[card.category].push(card);
  }

  for (const category of Object.keys(byCategory) as DeckCategory[]) {
    const rows = byCategory[category];
    if (!rows.length) continue;
    const zone = doc.createElement('zone');
    zone.setAttribute('name', categoryToZoneName(category));
    for (const row of rows) {
      const cardEl = writeCardElement(doc, row);
      // Round-trip the commander marker. Not a zone — the card is
      // still in main — just a UI flag for the deck editor's
      // "this is my commander" indicator. Cockatrice desktop
      // ignores unknown attributes, so cross-client edits preserve
      // the card even though they forget which one was commander.
      if (row.isCommander) {
        cardEl.setAttribute('commander', '1');
      }
      zone.appendChild(cardEl);
    }
    root.appendChild(zone);
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  // Modern browsers omit the XML declaration; prepend it so the file
  // matches Cockatrice desktop's output byte-for-byte on the header.
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;
}

/** Empty deck XML — used when creating a new deck. Optional `format`
 *  seeds the `<format>` element so New Deck can persist the user's
 *  format choice from the create modal. */
export function emptyCod(name = 'New Deck', format = 'commander'): string {
  return serializeCod({ name, meta: defaultMeta(), cards: [], format });
}

// ---------- helpers ----------

function readCardElement(
  el: Element,
  category: DeckCategory,
  isCommanderZone: boolean,
): ParsedCard | null {
  // `number` attribute is quantity. Default to 1 (Cockatrice desktop's default).
  const quantity = parseInt(el.getAttribute('number') || '1', 10);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  // Two accepted name locations: `name` attribute OR text content.
  const nameAttr = el.getAttribute('name')?.trim();
  const nameText = el.textContent?.trim();
  const name = nameAttr || nameText;
  if (!name) return null;

  // Commander marker sources, in priority order:
  //   1. Our own `commander="1"` attribute — modern serializeCod
  //      output. Card is in main; the attribute is a UI-only flag.
  //   2. `isCommanderZone` — legacy files where the enclosing
  //      `<zone>` was literally named "commander". We coerced the
  //      zone to `main` at the caller (so the card still ships to
  //      Servatrice's library), but we remember it was flagged.
  // Neither ever changes `category`, which stays a real zone name.
  const commanderAttr = el.getAttribute('commander')?.trim();
  const isCommander = commanderAttr === '1'
    || commanderAttr === 'true'
    || isCommanderZone;

  const parsed: ParsedCard = { name, quantity, category };
  if (isCommander) {
    parsed.isCommander = true;
  }
  // Accept both the Cockatrice-desktop names (setShortName /
  // collectorNumber) and our older short-form aliases (set / num).
  // Historic webatrice files use the short form; standard .cod files
  // use the long form.
  const set = el.getAttribute('setShortName')?.trim() || el.getAttribute('set')?.trim();
  const num = el.getAttribute('collectorNumber')?.trim() || el.getAttribute('num')?.trim();
  const uuid = el.getAttribute('uuid')?.trim();
  if (set) parsed.set = set;
  if (num) parsed.collectorNumber = num;
  if (uuid) parsed.scryfallId = uuid;
  return parsed;
}

function writeCardElement(doc: XMLDocument, card: DeckCard): Element {
  const el = doc.createElement('card');
  el.setAttribute('number', String(card.quantity));
  el.setAttribute('name', card.name);
  // Emit the Cockatrice-desktop-standard attribute names so files
  // written by us round-trip cleanly through the desktop client and
  // any third-party tooling that follows the same convention.
  if (card.set) el.setAttribute('setShortName', card.set);
  if (card.collectorNumber) el.setAttribute('collectorNumber', card.collectorNumber);
  if (card.scryfallId) el.setAttribute('uuid', card.scryfallId);
  return el;
}

function zoneNameToCategory(zoneName: string | null): DeckCategory {
  switch (zoneName?.toLowerCase()) {
    case 'side':
    case 'sideboard':
      return 'sideboard';
    default:
      // Anything else (main, commander, tokens, unknown) coerces to
      // main. Servatrice only reads main + side into the game
      // library at start, so shipping a card in any other zone
      // would silently drop it. Legacy commander-zone cards keep
      // their commander marking via ParsedCard.isCommander at the
      // caller.
      return 'main';
  }
}

function categoryToZoneName(category: DeckCategory): string {
  switch (category) {
    case 'sideboard': return 'side';
    case 'main': return 'main';
  }
}

function directChildren(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter((c) => c.tagName === tagName);
}

function firstChildText(parent: Element, tagName: string): string | null {
  const el = directChildren(parent, tagName)[0];
  return el?.textContent ?? null;
}

function appendTextElement(doc: XMLDocument, parent: Element, tagName: string, text: string): void {
  const el = doc.createElement(tagName);
  el.appendChild(doc.createTextNode(text));
  parent.appendChild(el);
}

// ---------- <bracketAssessment> reader + writer ----------
//
// Shape (matches the BracketAssessment type):
//
//   <bracketAssessment level="3" fingerprint="7f8a3b2c">
//     <gameChangers>
//       <card>Rhystic Study</card>
//     </gameChangers>
//     <turns>...</turns>
//     <turnsRestricted>...</turnsRestricted>
//     <denial>...</denial>
//     <denialRestricted>...</denialRestricted>
//     <earlyCombos>
//       <combo id="1234" totalMana="4">
//         <card>Thassa's Oracle</card>
//         <card>Demonic Consultation</card>
//       </combo>
//     </earlyCombos>
//     <lateCombos>...</lateCombos>
//   </bracketAssessment>
//
// Missing sub-elements are treated as empty lists; missing level or
// fingerprint short-circuits to `undefined` so a malformed cache is
// simply ignored and the next assessment overwrites it.

function readBracketAssessment(root: Element): BracketAssessment | undefined {
  const el = directChildren(root, 'bracketAssessment')[0];
  if (!el) return undefined;

  const levelAttr = parseInt(el.getAttribute('level') ?? '', 10);
  if (!Number.isInteger(levelAttr) || levelAttr < 1 || levelAttr > 5) return undefined;
  const level = levelAttr as 1 | 2 | 3 | 4 | 5;

  const fingerprint = el.getAttribute('fingerprint')?.trim();
  if (!fingerprint) return undefined;

  return {
    level,
    fingerprint,
    gameChangers: readCardListChild(el, 'gameChangers'),
    turns: readCardListChild(el, 'turns'),
    turnsRestricted: readCardListChild(el, 'turnsRestricted'),
    denial: readCardListChild(el, 'denial'),
    denialRestricted: readCardListChild(el, 'denialRestricted'),
    earlyCombos: readCombosChild(el, 'earlyCombos'),
    lateCombos: readCombosChild(el, 'lateCombos'),
  };
}

function writeBracketAssessment(doc: XMLDocument, a: BracketAssessment): Element {
  const el = doc.createElement('bracketAssessment');
  el.setAttribute('level', String(a.level));
  el.setAttribute('fingerprint', a.fingerprint);
  el.appendChild(writeCardList(doc, 'gameChangers', a.gameChangers));
  el.appendChild(writeCardList(doc, 'turns', a.turns));
  el.appendChild(writeCardList(doc, 'turnsRestricted', a.turnsRestricted));
  el.appendChild(writeCardList(doc, 'denial', a.denial));
  el.appendChild(writeCardList(doc, 'denialRestricted', a.denialRestricted));
  el.appendChild(writeCombos(doc, 'earlyCombos', a.earlyCombos));
  el.appendChild(writeCombos(doc, 'lateCombos', a.lateCombos));
  return el;
}

function readCardListChild(parent: Element, tagName: string): string[] {
  const el = directChildren(parent, tagName)[0];
  if (!el) return [];
  return directChildren(el, 'card')
    .map((c) => c.textContent?.trim() ?? '')
    .filter((n) => n.length > 0);
}

function writeCardList(doc: XMLDocument, tagName: string, names: string[]): Element {
  const el = doc.createElement(tagName);
  for (const name of names) appendTextElement(doc, el, 'card', name);
  return el;
}

function readCombosChild(parent: Element, tagName: string): BracketAssessmentCombo[] {
  const el = directChildren(parent, tagName)[0];
  if (!el) return [];
  const out: BracketAssessmentCombo[] = [];
  for (const comboEl of directChildren(el, 'combo')) {
    const id = comboEl.getAttribute('id')?.trim() ?? '';
    const totalManaAttr = parseFloat(comboEl.getAttribute('totalMana') ?? '0');
    const totalMana = Number.isFinite(totalManaAttr) ? totalManaAttr : 0;
    const cardNames = directChildren(comboEl, 'card')
      .map((c) => c.textContent?.trim() ?? '')
      .filter((n) => n.length > 0);
    if (id && cardNames.length > 0) out.push({ id, cardNames, totalMana });
  }
  return out;
}

function writeCombos(
  doc: XMLDocument,
  tagName: string,
  combos: BracketAssessmentCombo[],
): Element {
  const el = doc.createElement(tagName);
  for (const combo of combos) {
    const comboEl = doc.createElement('combo');
    comboEl.setAttribute('id', combo.id);
    comboEl.setAttribute('totalMana', String(combo.totalMana));
    for (const name of combo.cardNames) appendTextElement(doc, comboEl, 'card', name);
    el.appendChild(comboEl);
  }
  return el;
}
