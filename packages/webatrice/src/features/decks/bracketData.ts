/**
 * Data and rule constants for edhpowerlevel-style bracket assessment.
 *
 * Every value in this file was extracted from edhpowerlevel.com's
 * client bundle (2026-07-20 snapshot) so the resulting bracket matches
 * their published verdict as closely as possible. Their algorithm is
 * the de-facto community standard for Commander bracket judgment even
 * though it differs from WotC's official guidelines in several places
 * (notably around what qualifies as an "early" combo).
 *
 * If they revise the algorithm, we need to refresh these constants —
 * there's no live API to fetch, and the client bundle they ship has
 * hashed filenames that rotate every deploy.
 */

// ---------- Detection regexes ----------

/** Oracle-text pattern that flags a card as producing an extra turn. */
export const EDHPL_EXTRA_TURN_REGEX =
  /(take an extra turn|target player takes an extra turn|target player takes \w* extra turns)/i;

/** Oracle-text pattern that flags a card as mass land denial. */
export const EDHPL_MLD_REGEX =
  /(^(noncreature|creature|red|white|blue|black|green) spells|^spells your opponents cast) cost \{\d\} more to cast|each player sacrifices \w* (lands|land for each)|destroy all (lands|islands|mountains|forests|swamps|plains)|destroy all (\w*, )*and lands|untap (only|more than) \w* (land|permanent|nonbasic)|(islands|mountains|forests|swamps|plains|\w* lands) don't untap|nonbasic lands are (mountains|islands)/i;

// ---------- Curated card lists ----------

/** Extra-turn cards that are especially easy to chain — flagged
 *  separately from the regex-based extra-turn count because chaining
 *  is the actual play-pattern concern, not just having one Time Warp. */
export const RESTRICTED_EXTRA_TURNS: ReadonlySet<string> = new Set([
  'Time Warp',
  'Temporal Manipulation',
  'Walk the Aeons',
  'Capture of Jingzhou',
  'Expropriate',
  'Time Stretch',
  'Nexus of Fate',
  'Timestream Navigator',
  'Sage of Hours',
  'Lighthouse Chronologist',
  'Time Sieve',
  'Magosi, the Waterveil',
]);

/** Mass-land-denial cards that don't match the regex but should still
 *  count against the deck's MLD tally (curated additions). */
export const RESTRICTED_MLD: ReadonlySet<string> = new Set([
  'Vorinclex, Voice of Hunger',
  'Hall of Gemstone',
  'Contamination',
  'Cataclysm',
  'Dimensional Breach',
  'Epicenter',
  'Global Ruin',
  'Hokori, Dust Drinker',
  "Razia's Purification",
  'Rising Waters',
  'Soulscour',
  'Sunder',
  'Apocalypse',
  'Bearer of the Heavens',
  'Conversion',
  'Glaciers',
  'Pox',
  'Death Cloud',
  'Tangle Wire',
  'Restore Balance',
  'Realm Razer',
  'Spreading Algae',
  'Numot, the Devastator',
  'Kudzu',
  'Demonic Hordes',
  "Urza's Sylex",
  'Infernal Darkness',
  'Trinisphere',
  'Worldfire',
  'Worldslayer',
  'Gilt-Leaf Archdruid',
  'Worldpurge',
  'Stasis',
]);

/** Cards that would match the MLD regex but shouldn't count (false
 *  positives that edhpowerlevel explicitly excludes). */
export const MLD_WHITELIST: ReadonlySet<string> = new Set(['Charitable Levy']);

// ---------- Commander Spellbook combo filter ----------

/**
 * Whitelisted Spellbook "produces" feature IDs. When a combo's
 * produces list is entirely inside this set (i.e. it only makes mana
 * / filters cards / etc.), it's not considered game-defining and
 * gets dropped before bracket classification.
 *
 * We keep a combo when it produces AT LEAST ONE feature outside this
 * whitelist. Extracted from `we.producers` in the bundle.
 */
export const COMBO_PRODUCERS_WHITELIST: ReadonlySet<number> = new Set([
  7, 4, 3, 6, 17, 77, 60, 79, 325, 110, 505, 1111, 227, 87, 547, 2742, 2617,
]);

/** Whitelisted requirement template IDs — combos whose only
 *  requirement is on this list get downgraded (unless the combo has
 *  fewer than 3 total cards, in which case even a whitelisted
 *  requirement still counts). */
export const COMBO_REQUIREMENTS_WHITELIST: ReadonlySet<number> = new Set([28]);

/**
 * Notable-prerequisite rules. For each matching regex on a combo's
 * `notablePrerequisites` text, the second tuple element (when present)
 * is added to that combo's mana bill (`ka` in the bundle). When the
 * tuple has no second element, the combo is disqualified outright.
 */
export const COMBO_PREREQUISITE_RULES: ReadonlyArray<readonly [RegExp, number?]> = [
  [/walking ballista has at least two \+1\/\+1 counters on it\./, 4],
  // No numeric bonus — flags the combo as disqualified.
  [/you have a way to give (.+) (lifelink|indestructible|deathtouch|vigilance|persist|undying|trample|double strike|defender)\./],
];

/** Total-mana cutoff (inclusive) below which a combo is considered
 *  "early" and disqualifies the deck from Bracket ≤ 3. Above this
 *  cutoff the combo is "late" and only disqualifies Bracket ≤ 2. */
export const EARLY_COMBO_MANA_CUTOFF = 7;

// ---------- Per-bracket limits ----------

/** Per-category caps indexed by bracket 1..5. If a category's match
 *  count exceeds `maxes[N-1]`, the deck is pushed above bracket N. */
export const EDHPL_MAXES = {
  turns:        [0, 2, 3, 100, 100],
  denial:       [0, 0, 0, 100, 100],
  gameChangers: [0, 0, 3, 100, 100],
  earlyCombos:  [0, 0, 0, 100, 100],
  lateCombos:   [0, 0, 100, 100, 100],
} as const;

/** Restricted-list "auto-bump" threshold. Any restricted extra-turn
 *  or restricted MLD card in the deck bumps the minimum bracket to
 *  this value. */
export const RESTRICTED_UNDER_BRACKET = 3;

// ---------- Display labels ----------

export const BRACKET_LABEL: Record<number, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
};
