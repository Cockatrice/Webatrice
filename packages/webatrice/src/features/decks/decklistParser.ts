import type { DeckCategory } from '@app/types';

export type ExtraZone = 'tokens' | 'maybeboard';

export type ParsedEntry = {
  quantity: number;
  name: string;
  category: DeckCategory;
  isCommander?: boolean;
  extraZone?: ExtraZone;
  set?: string;
  collectorNumber?: string;
};

export type ParseResult = {
  entries: ParsedEntry[];
  ignored: string[];
  name?: string;
  description?: string;
};

type Section = { category: DeckCategory; isCommander?: boolean; extraZone?: ExtraZone; about?: boolean };

const MAIN: Section = { category: 'main' };
const SIDE: Section = { category: 'sideboard' };

const SECTIONS: Array<[RegExp, Section]> = [
  [/^(?:main\s*deck|main(?:board)?|deck(?:list)?)$/, MAIN],
  [/^commanders?$/, { category: 'main', isCommander: true }],
  [/^(?:side\s*board|sideboard|companion)$/, SIDE],
  [/^(?:maybe\s*board|maybeboard|considering)$/, { category: 'main', extraZone: 'maybeboard' }],
  [/^tokens?$/, { category: 'main', extraZone: 'tokens' }],
  [/^about$/, { category: 'main', about: true }],
];

const SECTION_LINE = /^\s*(?:\/\/\s*|#\s*)?([a-z][a-z ]*?)\s*(?:\(\d+\))?\s*:?\s*$/i;
const COMMENT_LINE = /^\s*(?:\/\/|#)/;
const SB_PREFIX = /^\s*SB:\s*/i;
const QUANTITY = /^[xX([]*(\d+)[xX*)\]]* ?(.+)$/;
const MWS_SET = /^\[([A-Za-z0-9]{2,6})\]\s*(.+)$/;
const SET_SUFFIX = /\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([0-9A-Za-z][0-9A-Za-z★†-]*))?$/;
const MARKER_SUFFIX = /\s+(?:\*([A-Za-z]+)\*|\^[^^]*\^|\[([^\]]*)\])$/;
const GROUP_HEADER = /^[A-Za-z][A-Za-z ,'-]*\s*\(\d+\)$/;
const ARENA_NAME = /^\s*Name\s+(.+)$/i;
const BASIC_LAND = /^(?:snow-covered\s+)?(?:plains|island|swamp|mountain|forest|wastes)$/i;

function sectionOf(line: string): Section | null {
  const match = line.match(SECTION_LINE);
  if (!match) {
    return null;
  }
  const word = match[1].trim().toLowerCase();
  for (const [pattern, section] of SECTIONS) {
    if (pattern.test(word)) {
      return section;
    }
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .replace(/’/g, '\'')
    .replace(/\s*\(Transform\)\s*/i, ' ')
    .replace(/\s*[|/]+\s*/g, ' // ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CardLine {
  entry: ParsedEntry;
  sideboardMark: boolean;
}

function parseCardLine(raw: string, section: Section): CardLine | null {
  let line = raw.trim();
  const sideboardMark = SB_PREFIX.test(line);
  if (sideboardMark) {
    line = line.replace(SB_PREFIX, '');
  }

  let isCommander = section.isCommander === true;
  let category = sideboardMark ? 'sideboard' as const : section.category;
  let extraZone = sideboardMark ? undefined : section.extraZone;

  for (let marker = line.match(MARKER_SUFFIX); marker; marker = line.match(MARKER_SUFFIX)) {
    const flag = marker[1]?.toUpperCase();
    if (flag === 'CMDR') {
      isCommander = true;
    }
    for (const tag of (marker[2] ?? '').split(',').map((part) => part.replace(/\{[^}]*\}/g, '').trim().toLowerCase())) {
      if (tag === 'commander') {
        isCommander = true;
      } else if (tag === 'sideboard') {
        category = 'sideboard';
      } else if (tag === 'maybeboard') {
        extraZone = 'maybeboard';
      }
    }
    line = line.slice(0, marker.index).trimEnd();
  }

  let quantity = 1;
  const counted = line.match(QUANTITY);
  if (counted) {
    quantity = parseInt(counted[1], 10);
    line = counted[2];
  } else if (!/^[\p{L}[]/u.test(line) || GROUP_HEADER.test(line)) {
    return null;
  }

  let set: string | undefined;
  let collectorNumber: string | undefined;
  const mws = line.match(MWS_SET);
  if (mws) {
    set = mws[1].toUpperCase();
    line = mws[2];
  }
  const suffix = line.match(SET_SUFFIX);
  if (suffix) {
    set = suffix[1].toUpperCase();
    collectorNumber = suffix[2];
    line = line.slice(0, suffix.index);
  }

  const name = normalizeName(line);
  if (!name || quantity < 1) {
    return null;
  }
  return {
    sideboardMark,
    entry: {
      quantity,
      name,
      category: isCommander ? 'main' : category,
      ...(isCommander ? { isCommander: true } : {}),
      ...(extraZone && !isCommander ? { extraZone } : {}),
      ...(set ? { set } : {}),
      ...(collectorNumber ? { collectorNumber } : {}),
    },
  };
}

function headerLines(lines: string[]): { name?: string; description?: string; start: number } {
  const firstBlank = lines.findIndex((line) => !line.trim());
  if (firstBlank <= 0) {
    return { start: 0 };
  }
  const head = lines.slice(0, firstBlank);
  if (!head.every((line) => COMMENT_LINE.test(line)) || head.some((line) => sectionOf(line))) {
    return { start: 0 };
  }
  const text = head.map((line) => line.replace(COMMENT_LINE, '').trim()).filter(Boolean);
  if (!text.length) {
    return { start: firstBlank };
  }
  return {
    name: text[0],
    ...(text.length > 1 ? { description: text.slice(1).join('\n') } : {}),
    start: firstBlank,
  };
}

export function parseDecklist(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.replace(/\s+$/, ''));
  const header = headerLines(lines);
  const entries: ParsedEntry[] = [];
  const blockOf: number[] = [];
  const ignored: string[] = [];
  let name = header.name;
  let section = MAIN;
  let sawSection = false;
  let sawMark = false;
  let block = 0;
  let blankSinceCard = false;

  for (const line of lines.slice(header.start)) {
    if (!line.trim()) {
      blankSinceCard = entries.length > 0;
      continue;
    }
    const nextSection = sectionOf(line);
    if (nextSection) {
      section = nextSection;
      sawSection = sawSection || nextSection !== MAIN;
      continue;
    }
    if (section.about) {
      const arenaName = line.match(ARENA_NAME);
      if (arenaName && !name) {
        name = arenaName[1].trim();
      }
      continue;
    }
    if (COMMENT_LINE.test(line)) {
      continue;
    }
    const parsed = parseCardLine(line, section);
    if (!parsed) {
      ignored.push(line);
      continue;
    }
    if (blankSinceCard) {
      block += 1;
      blankSinceCard = false;
    }
    sawMark = sawMark || parsed.sideboardMark;
    entries.push(parsed.entry);
    blockOf.push(block);
  }

  if (!sawSection && !sawMark && block === 1) {
    entries.forEach((entry, i) => {
      if (blockOf[i] === 1 && !entry.isCommander && !entry.extraZone) {
        entry.category = 'sideboard';
      }
    });
  }

  return {
    entries,
    ignored,
    ...(name ? { name } : {}),
    ...(header.description ? { description: header.description } : {}),
  };
}

export function isBasicLand(name: string): boolean {
  return BASIC_LAND.test(name.trim());
}

type CountedCard = Pick<ParsedEntry, 'name' | 'quantity' | 'category' | 'isCommander'> & { extraZone?: ExtraZone };

function looksSingleton(cards: readonly CountedCard[]): boolean {
  return cards.every((card) => card.quantity === 1 || isBasicLand(card.name));
}

function deckCount(cards: readonly CountedCard[], category: DeckCategory): number {
  return cards
    .filter((card) => card.category === category && !card.extraZone)
    .reduce((sum, card) => sum + card.quantity, 0);
}

export function promoteSideboardCommanders<T extends CountedCard>(cards: readonly T[]): T[] {
  if (cards.some((card) => card.isCommander)) {
    return [...cards];
  }
  const side = cards.filter((card) => card.category === 'sideboard' && !card.extraZone);
  const main = cards.filter((card) => card.category === 'main' && !card.extraZone);
  const sideCount = deckCount(cards, 'sideboard');
  if (sideCount < 1 || sideCount > 2 || side.some((card) => card.quantity !== 1)) {
    return [...cards];
  }
  if (deckCount(cards, 'main') + sideCount !== 100 || !looksSingleton(main)) {
    return [...cards];
  }
  return cards.map((card) => (side.includes(card) ? { ...card, category: 'main', isCommander: true } : card));
}

export function inferDeckFormat(cards: readonly CountedCard[]): string {
  if (cards.some((card) => card.isCommander)) {
    return 'commander';
  }
  const main = cards.filter((card) => card.category === 'main' && !card.extraZone);
  const mainCount = deckCount(cards, 'main');
  if (mainCount >= 98 && mainCount <= 100 && looksSingleton(main)) {
    return 'commander';
  }
  return '';
}
