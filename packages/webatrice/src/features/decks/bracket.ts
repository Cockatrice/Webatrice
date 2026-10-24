
import {
  COMBO_PREREQUISITE_RULES,
  COMBO_PRODUCERS_WHITELIST,
  COMBO_REQUIREMENTS_WHITELIST,
  EARLY_COMBO_MANA_CUTOFF,
  EDHPL_EXTRA_TURN_REGEX,
  EDHPL_MAXES,
  EDHPL_MLD_REGEX,
  MLD_WHITELIST,
  RESTRICTED_EXTRA_TURNS,
  RESTRICTED_MLD,
  RESTRICTED_UNDER_BRACKET,
} from './bracketData';
import type { BracketAssessment } from '@app/types';

import {
  fetchGameChangers,
  fetchOracleText,
  fetchSpellbookCombos,
  type BracketSource,
  type SourceFailure,
  type SourceResult,
  type SpellbookCombo,
} from './bracketSources';
import type { DeckCard } from './types';

// ---------- Types ----------

export interface ComboSummary {
  /** Spellbook combo id, used for the "view on Spellbook" link. */
  id: string;
  /** Card names participating in this combo (from the user's deck). */
  cardNames: string[];
  /** Total mana bill: combo.mv + sum(cmc of on-battlefield combo cards)
   *  + prerequisite bonuses. Used for the early/late split. */
  totalMana: number;
}

export interface BracketSignals {
  turns: { matches: string[]; restricted: string[] };
  denial: { matches: string[]; restricted: string[] };
  gameChangers: { matches: string[] };
  earlyCombos: ComboSummary[];
  lateCombos: ComboSummary[];
}

export interface BracketReport {
  /** 1..5 — the deck's floor. Corresponds to edhpowerlevel's
   *  "Minimum Bracket". */
  level: 1 | 2 | 3 | 4 | 5;
  signals: BracketSignals;
}

// ---------- Fingerprinting ----------
//
// The bracket assessment depends on the deck's card names and quantities
// and, since the Spellbook lookup sends only the main deck with the
// commanders apart, on each card's zone and commander flag. Printing swaps
// don't matter. We store a short hash of that shape in the cached
// `<bracketAssessment>` element so consumers can tell at a glance whether
// the cache is still valid.

export function deckFingerprintSource(cards: DeckCard[]): string {
  return cards
    .map((c) => {
      const base = `${c.name.toLowerCase()}x${c.quantity}`;
      if (c.category === 'sideboard') {
        return `${base}@side`;
      }
      return c.isCommander ? `${base}@commander` : base;
    })
    .sort()
    .join('|');
}

/** Short (8-char, base36) hash of the deck fingerprint. FNV-1a — cheap,
 *  not cryptographic, but plenty for a cache-invalidation key. */
export function deckFingerprint(cards: DeckCard[]): string {
  return fnv1aBase36(deckFingerprintSource(cards));
}

function fnv1aBase36(s: string): string {
  // 32-bit FNV-1a, then rendered in base36 and padded to a stable 8
  // chars so the XML attribute doesn't wiggle in length across saves.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // Math.imul for 32-bit multiply (JS numbers otherwise overflow to floats).
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned so base36 doesn't render a leading `-`.
  return (h >>> 0).toString(36).padStart(8, '0');
}

// ---------- Classifier + reducer ----------

function classify(matchCount: number, maxes: readonly number[], restrictedCount = 0): number {
  let I = 0;
  maxes.forEach((max, idx) => {
    if (matchCount > max) {
      I = idx + 1;
    }
  });
  if (restrictedCount > 0 && I < RESTRICTED_UNDER_BRACKET) {
    I = RESTRICTED_UNDER_BRACKET;
  }
  return I;
}

function reduceBracket(signals: BracketSignals): 1 | 2 | 3 | 4 | 5 {
  const t = classify(
    signals.turns.matches.length,
    EDHPL_MAXES.turns,
    signals.turns.restricted.length,
  );
  const d = classify(
    signals.denial.matches.length,
    EDHPL_MAXES.denial,
    signals.denial.restricted.length,
  );
  const g = classify(signals.gameChangers.matches.length, EDHPL_MAXES.gameChangers);
  const e = classify(signals.earlyCombos.length, EDHPL_MAXES.earlyCombos);
  const l = classify(signals.lateCombos.length, EDHPL_MAXES.lateCombos);
  const idx = Math.max(t, d, g, e, l);
  return (idx + 1) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Apply edhpowerlevel's combo filter (extracted from their `we` object
 * and combo-processing loop) to raw Spellbook combos. Returns two
 * lists: game-defining combos partitioned into early (≤7 total mana)
 * and late (>7 total mana). Combos that are non-game-defining
 * (mana-producing chains, filter effects, etc.) or that require a
 * disqualifying prerequisite get dropped entirely.
 */
function filterAndSplitCombos(
  combos: SpellbookCombo[],
  cards: DeckCard[],
): { early: ComboSummary[]; late: ComboSummary[] } {
  const cmcByName = new Map<string, number>();
  for (const c of cards) {
    if (c.cmc != null) {
      cmcByName.set(c.name, c.cmc);
    }
  }

  const early: ComboSummary[] = [];
  const late: ComboSummary[] = [];

  for (const combo of combos) {
    const uses = combo.uses ?? [];
    const produces = combo.produces ?? [];
    const requires = combo.requires ?? [];

    // A = total card count in combo (base cards + template quantities).
    let A = uses.length;

    // oa: at least one produced feature is game-defining.
    let oa = false;
    for (const p of produces) {
      const featureId = p.feature?.id;
      if (featureId != null && !COMBO_PRODUCERS_WHITELIST.has(featureId)) {
        oa = true;
        break;
      }
    }

    // ba: at least one required template is game-defining OR the combo
    // has no requirements at all. BUT if the total card count is <3,
    // this gets reset (i.e., 2-card combos with only-whitelisted
    // requirements are downgraded).
    let ba = requires.length < 1;
    for (const r of requires) {
      if (r.template != null && typeof r.quantity === 'number') {
        A += r.quantity;
      }
      if (r.template != null && !COMBO_REQUIREMENTS_WHITELIST.has(r.template.id)) {
        ba = true;
      }
      if (A < 3) {
        ba = false;
      }
    }

    // da: no notable-prerequisite disqualifier. ka: prerequisite-based
    // mana bill adjustments.
    let da = true;
    let ka = 0;
    const prereqs = combo.notablePrerequisites
      ? combo.notablePrerequisites.split('\n')
      : [];
    for (const line of prereqs) {
      for (const [regex, bonus] of COMBO_PREREQUISITE_RULES) {
        if (regex.test(line.toLowerCase())) {
          if (typeof bonus !== 'undefined') {
            ka += bonus;
          } else {
            da = false;
          }
        }
      }
    }

    // Keep the combo only when all four filter flags pass AND it's a
    // strictly 2-card combo (A < 3).
    if (!(oa && ba && da && A < 3)) {
      continue;
    }

    // Sum CMC of on-battlefield combo cards. Spellbook zones use "B"
    // for battlefield.
    let ya = 0;
    for (const c of uses) {
      if (c.zoneLocations?.includes('B')) {
        const cmc = cmcByName.get(c.card.name) ?? 0;
        ya += cmc;
      }
    }

    const totalMana = (combo.manaValueNeeded ?? 0) + ya + ka;
    const summary: ComboSummary = {
      id: combo.id,
      cardNames: uses.map((c) => c.card.name),
      totalMana,
    };
    if (totalMana > EARLY_COMBO_MANA_CUTOFF) {
      late.push(summary);
    } else {
      early.push(summary);
    }
  }

  return { early, late };
}

// ---------- Top-level analysis ----------

export interface UnavailableSource {
  source: BracketSource;
  failure: SourceFailure;
  missing?: number;
  total?: number;
}

export interface BracketAnalysis {
  report: BracketReport;
  unavailable: UnavailableSource[];
}

export function isCompleteAnalysis(analysis: BracketAnalysis): boolean {
  return analysis.unavailable.length === 0;
}

export async function analyzeBracket(cards: DeckCard[]): Promise<BracketAnalysis> {
  const names = Array.from(new Set(cards.map((c) => c.name)));

  const [gameChangersResult, oracleResult, combosResult] = await Promise.all([
    fetchGameChangers(),
    fetchOracleText(names),
    fetchSpellbookCombos(cards),
  ]);

  const unavailable: UnavailableSource[] = [];
  const dataOf = <T>(source: BracketSource, result: SourceResult<T>, empty: T): T => {
    if (result.status === 'unavailable') {
      unavailable.push({ source, failure: result.failure });
      return empty;
    }
    if (result.status === 'partial') {
      unavailable.push({ source, failure: result.failure, missing: result.missing, total: result.total });
    }
    return result.data;
  };
  const gameChangers = dataOf('gameChangers', gameChangersResult, new Set<string>());
  const oracleByName = dataOf('oracleText', oracleResult, new Map<string, string>());
  const rawCombos = dataOf('combos', combosResult, [] as SpellbookCombo[]);

  const turnsMatches: string[] = [];
  const turnsRestricted: string[] = [];
  const denialMatches: string[] = [];
  const denialRestricted: string[] = [];
  const gameChangerMatches: string[] = [];

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.name)) {
      continue;
    }
    seen.add(card.name);
    const oracle = oracleByName.get(card.name.toLowerCase()) ?? '';

    // Extra turns: regex-based detection.
    if (EDHPL_EXTRA_TURN_REGEX.test(oracle)) {
      turnsMatches.push(card.name);
    }
    if (RESTRICTED_EXTRA_TURNS.has(card.name)) {
      turnsRestricted.push(card.name);
    }

    // MLD: regex + curated list, but never for whitelisted names.
    if (!MLD_WHITELIST.has(card.name) && EDHPL_MLD_REGEX.test(oracle)) {
      denialMatches.push(card.name);
    }
    if (RESTRICTED_MLD.has(card.name)) {
      denialRestricted.push(card.name);
    }

    // Game Changers: exact-name membership.
    if (gameChangers.has(card.name)) {
      gameChangerMatches.push(card.name);
    }
  }

  const { early, late } = filterAndSplitCombos(rawCombos, cards);

  const signals: BracketSignals = {
    turns: { matches: turnsMatches, restricted: turnsRestricted },
    denial: { matches: denialMatches, restricted: denialRestricted },
    gameChangers: { matches: gameChangerMatches },
    earlyCombos: early,
    lateCombos: late,
  };

  return { report: { level: reduceBracket(signals), signals }, unavailable };
}

/**
 * Flatten a live `BracketReport` into the shape we persist on the .cod
 * (`<bracketAssessment>`). Discards derived state (badge tone, etc.)
 * and stamps the deck's current fingerprint so future opens can
 * detect staleness cheaply.
 */
export function toBracketAssessment(
  report: BracketReport,
  fingerprint: string,
): BracketAssessment {
  return {
    level: report.level,
    fingerprint,
    gameChangers: report.signals.gameChangers.matches,
    turns: report.signals.turns.matches,
    turnsRestricted: report.signals.turns.restricted,
    denial: report.signals.denial.matches,
    denialRestricted: report.signals.denial.restricted,
    earlyCombos: report.signals.earlyCombos.map((c) => ({
      id: c.id,
      cardNames: c.cardNames,
      totalMana: c.totalMana,
    })),
    lateCombos: report.signals.lateCombos.map((c) => ({
      id: c.id,
      cardNames: c.cardNames,
      totalMana: c.totalMana,
    })),
  };
}

/**
 * Rehydrate a cached `BracketAssessment` back into the runtime
 * `BracketReport` shape the BracketSection UI expects. No network — we
 * trust the stored numbers because the caller has already verified the
 * fingerprint matches the current deck.
 */
export function fromBracketAssessment(a: BracketAssessment): BracketReport {
  return {
    level: a.level,
    signals: {
      turns: { matches: a.turns, restricted: a.turnsRestricted },
      denial: { matches: a.denial, restricted: a.denialRestricted },
      gameChangers: { matches: a.gameChangers },
      earlyCombos: a.earlyCombos.map((c) => ({
        id: c.id,
        cardNames: c.cardNames,
        totalMana: c.totalMana,
      })),
      lateCombos: a.lateCombos.map((c) => ({
        id: c.id,
        cardNames: c.cardNames,
        totalMana: c.totalMana,
      })),
    },
  };
}
