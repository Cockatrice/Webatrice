/**
 * Bracket assessment for Commander decks. Faithful port of the
 * algorithm edhpowerlevel.com runs client-side (see `bracketData.ts`
 * for constants copied from their bundle). We use their algorithm
 * because it's the community's de-facto standard — WotC's official
 * bracket rules are looser and don't match player consensus,
 * especially on combos.
 *
 * External data sources:
 *   • Scryfall — `is:gamechanger` for the Game Changers list,
 *     `/cards/collection` for oracle text on every deck card.
 *   • Commander Spellbook — `POST /find-my-combos/` returns every
 *     Spellbook combo present in the deck.
 *
 * Session-cached where practical; both endpoints are public.
 */

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
import type { BracketAssessment, DeckCard } from './types';

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
// The bracket assessment only depends on the deck's (card name, quantity)
// shape — printing swaps and category toggles don't matter. We store a
// short hash of that shape in the cached `<bracketAssessment>` element
// so consumers can tell at a glance whether the cache is still valid.

/** Canonical string form of a deck for fingerprinting. Case-insensitive
 *  on names, quantity-aware, order-independent. */
export function deckFingerprintSource(cards: DeckCard[]): string {
  return cards
    .map((c) => `${c.name.toLowerCase()}x${c.quantity}`)
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
    if (matchCount > max) I = idx + 1;
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

// ---------- Scryfall: Game Changers list ----------

let gameChangersCache: Set<string> | null = null;
let gameChangersInFlight: Promise<Set<string>> | null = null;

/** Fetches WotC's Game Changers list from Scryfall (`is:gamechanger`)
 *  and returns the set of card names. Cached for the session. */
export async function fetchGameChangers(): Promise<Set<string>> {
  if (gameChangersCache) return gameChangersCache;
  if (gameChangersInFlight) return gameChangersInFlight;
  gameChangersInFlight = (async () => {
    try {
      const url = 'https://api.scryfall.com/cards/search?q=is%3Agamechanger&order=name&unique=cards';
      const res = await fetch(url);
      if (!res.ok) return new Set<string>();
      const body = (await res.json()) as { data?: Array<{ name: string }> };
      const names = new Set<string>();
      for (const c of body.data ?? []) names.add(c.name);
      gameChangersCache = names;
      return names;
    } catch {
      return new Set<string>();
    } finally {
      gameChangersInFlight = null;
    }
  })();
  return gameChangersInFlight;
}

// ---------- Scryfall: oracle text bulk lookup ----------

interface ScryfallCollectionCard {
  name: string;
  oracle_text?: string;
  card_faces?: Array<{ oracle_text?: string }>;
}

// Session cache — oracle text almost never changes for a given name.
const oracleCache = new Map<string, string>();
const oracleInFlight = new Map<string, Promise<void>>();

/** Bulk-fetch oracle text for the given card names via Scryfall's
 *  `/cards/collection` endpoint (75 identifiers per POST). Cards not
 *  found on Scryfall get an empty-string cache entry so we don't
 *  re-query them next render. Returns a Map keyed by lowercased name. */
export async function fetchOracleTextByName(names: string[]): Promise<Map<string, string>> {
  const uniqueLower = Array.from(new Set(names.map((n) => n.toLowerCase())));
  const need: string[] = [];
  const awaiting: Array<Promise<void>> = [];
  for (const key of uniqueLower) {
    if (oracleCache.has(key)) continue;
    const pending = oracleInFlight.get(key);
    if (pending) awaiting.push(pending);
    else need.push(key);
  }

  if (need.length > 0) {
    // Preserve the original casing for the Scryfall payload.
    const originalByLower = new Map<string, string>();
    for (const n of names) originalByLower.set(n.toLowerCase(), n);

    for (let i = 0; i < need.length; i += 75) {
      const chunk = need.slice(i, i + 75);
      const identifiers = chunk.map((k) => ({ name: originalByLower.get(k) ?? k }));
      const p = (async () => {
        try {
          const res = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers }),
          });
          if (!res.ok) {
            for (const k of chunk) oracleCache.set(k, '');
            return;
          }
          const body = (await res.json()) as { data?: ScryfallCollectionCard[] };
          const returnedLower = new Set<string>();
          for (const card of body.data ?? []) {
            const combined =
              card.oracle_text ??
              (card.card_faces ?? []).map((f) => f.oracle_text ?? '').filter(Boolean).join('\n') ??
              '';
            const key = card.name.toLowerCase();
            oracleCache.set(key, combined);
            returnedLower.add(key);
            // Also handle split-card name form ("A // B") — key by
            // the first face too so callers who asked for that
            // single name still hit.
            const firstFace = key.split(' // ')[0];
            if (firstFace !== key) {
              oracleCache.set(firstFace, combined);
              returnedLower.add(firstFace);
            }
          }
          // Names Scryfall didn't return get empty-string cache entries.
          for (const k of chunk) {
            if (!returnedLower.has(k)) oracleCache.set(k, '');
          }
        } catch {
          for (const k of chunk) oracleCache.set(k, '');
        }
      })();
      for (const k of chunk) oracleInFlight.set(k, p);
      try {
        await p;
      } finally {
        for (const k of chunk) oracleInFlight.delete(k);
      }
    }
  }

  await Promise.all(awaiting);
  const out = new Map<string, string>();
  for (const key of uniqueLower) {
    const text = oracleCache.get(key);
    if (text != null) out.set(key, text);
  }
  return out;
}

// ---------- Commander Spellbook: combos ----------

/** Shape of a combo in Commander Spellbook's find-my-combos response.
 *  The API uses `uses` for the on-deck cards (not `cards` as some docs
 *  suggest); `requires` items have a `template` with an id. All array
 *  fields are treated defensively — some legacy combos may omit fields. */
interface SpellbookCombo {
  id: string;
  uses?: Array<{
    card: { name: string };
    quantity?: number;
    zoneLocations?: string[];
  }>;
  produces?: Array<{ feature?: { id: number }; quantity?: number }>;
  requires?: Array<{
    template?: { id: number };
    quantity?: number;
    zoneLocations?: string[];
  }>;
  manaValueNeeded?: number;
  notablePrerequisites?: string;
}

interface SpellbookResponse {
  results: {
    included?: SpellbookCombo[];
  };
}

/**
 * POSTs the user's deck to Commander Spellbook's find-my-combos endpoint
 * and returns the raw included combos (all Spellbook combos where every
 * required card is present in the deck). Caller applies the edhpowerlevel
 * filter to get the "game-defining" subset.
 */
async function fetchSpellbookCombos(cards: DeckCard[]): Promise<SpellbookCombo[]> {
  // Spellbook expects an object with a `main` array of card entries.
  // Merge quantities across categories — Spellbook doesn't care about
  // main-vs-sideboard for combo detection.
  const merged = new Map<string, number>();
  for (const c of cards) {
    merged.set(c.name, (merged.get(c.name) ?? 0) + c.quantity);
  }
  const main = Array.from(merged, ([card, quantity]) => ({ card, quantity }));

  try {
    const res = await fetch('https://backend.commanderspellbook.com/find-my-combos/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main }),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as SpellbookResponse;
    return body.results?.included ?? [];
  } catch {
    return [];
  }
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
    if (c.cmc != null) cmcByName.set(c.name, c.cmc);
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
      if (A < 3) ba = false;
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
          if (typeof bonus !== 'undefined') ka += bonus;
          else da = false;
        }
      }
    }

    // Keep the combo only when all four filter flags pass AND it's a
    // strictly 2-card combo (A < 3).
    if (!(oa && ba && da && A < 3)) continue;

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
    if (totalMana > EARLY_COMBO_MANA_CUTOFF) late.push(summary);
    else early.push(summary);
  }

  return { early, late };
}

// ---------- Top-level analysis ----------

/**
 * Run the full bracket assessment on a deck. Fires three network
 * requests in parallel (Game Changers list, per-card oracle text,
 * Spellbook combo detection), then applies the local classifier.
 * Returns a fully-populated report — callers render whatever they
 * want from `signals`.
 */
export async function analyzeBracket(cards: DeckCard[]): Promise<BracketReport> {
  const names = Array.from(new Set(cards.map((c) => c.name)));

  const [gameChangers, oracleByName, rawCombos] = await Promise.all([
    fetchGameChangers(),
    fetchOracleTextByName(names),
    fetchSpellbookCombos(cards),
  ]);

  const turnsMatches: string[] = [];
  const turnsRestricted: string[] = [];
  const denialMatches: string[] = [];
  const denialRestricted: string[] = [];
  const gameChangerMatches: string[] = [];

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    const oracle = oracleByName.get(card.name.toLowerCase()) ?? '';

    // Extra turns: regex-based detection.
    if (EDHPL_EXTRA_TURN_REGEX.test(oracle)) turnsMatches.push(card.name);
    if (RESTRICTED_EXTRA_TURNS.has(card.name)) turnsRestricted.push(card.name);

    // MLD: regex + curated list, but never for whitelisted names.
    if (!MLD_WHITELIST.has(card.name) && EDHPL_MLD_REGEX.test(oracle)) {
      denialMatches.push(card.name);
    }
    if (RESTRICTED_MLD.has(card.name)) denialRestricted.push(card.name);

    // Game Changers: exact-name membership.
    if (gameChangers.has(card.name)) gameChangerMatches.push(card.name);
  }

  const { early, late } = filterAndSplitCombos(rawCombos, cards);

  const signals: BracketSignals = {
    turns: { matches: turnsMatches, restricted: turnsRestricted },
    denial: { matches: denialMatches, restricted: denialRestricted },
    gameChangers: { matches: gameChangerMatches },
    earlyCombos: early,
    lateCombos: late,
  };

  return { level: reduceBracket(signals), signals };
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
