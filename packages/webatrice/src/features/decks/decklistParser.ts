import type { DeckCategory } from './types';

/**
 * Parse a pasted Magic deck list into (quantity, name, category)
 * tuples. Ported from fancy webatrice's `decklistParser.ts` — same
 * grammar tolerances so users who exported from Moxfield / Arena /
 * MTGO / Cockatrice can paste without editing.
 *
 * Supported shapes (case-insensitive on section markers):
 *   4 Lightning Bolt
 *   4x Lightning Bolt              — MTGA export sometimes uses `x`
 *   1 Sol Ring (2XM) 300           — MTGA export with set + collector number
 *   SB: 2 Wear // Tear             — old MTGO sideboard prefix (mapped to sideboard)
 *   Deck                            — section marker (mainboard)
 *   Commander                       — section marker (commander zone)
 *   Sideboard                       — section marker (sideboard zone)
 *   Companion                       — treated as sideboard
 *   //  or  #  starts a comment (whole line ignored)
 *
 * We drop empty lines. Set + collector number are captured for future
 * printing-pinning; the current caller only uses `name` for the card
 * lookup. Sideboard cards are preserved (Cockatrice supports side
 * zones in Commander decks — used for wishboards / extras).
 */

export type ParsedEntry = {
  quantity: number;
  name: string;
  category: DeckCategory;
  set?: string;
  collectorNumber?: string;
};

export type ParseResult = {
  entries: ParsedEntry[];
  /** Lines we couldn't make sense of, surfaced back to the user so a
   *  malformed paste doesn't silently drop cards. */
  ignored: string[];
};

// Section marker lines (whole line, tolerant of trailing text like "Deck (100)")
const SECTION_RE = /^\s*(deck|main(?:board)?|commander|sideboard|maybeboard|companion|about)\b/i;

// Comment / metadata lines to skip silently
const COMMENT_RE = /^\s*(?:\/\/|#)/;

// Card line: quantity [x] name [(SET) collector]
// Groups: 1=qty, 2=name (greedy), 3=set (optional), 4=collector (optional)
const CARD_RE =
  /^\s*(\d+)\s*x?\s+([^()\n]+?)(?:\s+\(([A-Za-z0-9]{2,5})\)\s+([0-9A-Za-z-★]+))?\s*$/;

// MTGO-style sideboard prefix: "SB: 1 Card Name"
const SB_PREFIX_RE = /^\s*SB:\s*/i;

function mapSection(header: string): DeckCategory {
  const h = header.toLowerCase();
  if (h.startsWith('commander')) return 'commander';
  if (h.startsWith('sideboard') || h.startsWith('companion') || h.startsWith('maybeboard')) {
    return 'sideboard';
  }
  return 'main';
}

export function parseDecklist(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const ignored: string[] = [];
  let currentSection: DeckCategory = 'main';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (COMMENT_RE.test(line)) continue;

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      currentSection = mapSection(sectionMatch[1]);
      continue;
    }

    // MTGO explicit sideboard prefix overrides the current section
    // marker for that single line.
    let workingLine = line;
    let sectionForThisLine = currentSection;
    if (SB_PREFIX_RE.test(workingLine)) {
      workingLine = workingLine.replace(SB_PREFIX_RE, '');
      sectionForThisLine = 'sideboard';
    }

    const m = workingLine.match(CARD_RE);
    if (!m) {
      ignored.push(line);
      continue;
    }
    const [, qty, name, set, collector] = m;
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity < 1) {
      ignored.push(line);
      continue;
    }
    entries.push({
      quantity,
      name: name.trim(),
      category: sectionForThisLine,
      set: set || undefined,
      collectorNumber: collector || undefined,
    });
  }

  return { entries, ignored };
}
