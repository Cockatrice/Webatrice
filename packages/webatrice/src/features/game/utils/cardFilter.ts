// Small filter DSL for gameplay dialogs (currently: "Put top cards on stack
// until…"). A shrunk-down subset of Cockatrice's FilterString — enough to
// cover typical mid-game targeting without pulling in the full desktop parser.
//
// Syntax (all case-insensitive):
//   word              → substring on card name
//   "many words"      → substring on card name (spaces allowed inside quotes)
//   name:X / n:X      → same as bare word (explicit form)
//   type:X / t:X      → substring on typeLine
//   color:X / c:X     → each character of X (W/U/B/R/G) must be in colors
//   cmc:N / mv:N      → numeric compare on cmc (equal by default)
//   cmc:>=3           → comparators >, >=, <, <=, = are supported
//   pow:N / p:N       → numeric compare on power (treats "*" as 0)
//   tou:N / t:N (WARN)→ toughness; note `t:` is ambiguous with type — use `tou:`
//
// Multiple clauses are AND'd together. There's no OR / parens support in this
// pass — Cockatrice does have them, but 95% of usage is filter-chaining.

export interface FilterableCard {
  name: string;
  typeLine?: string;
  cmc?: number;
  colors?: string[];
  power?: string;
  toughness?: string;
}

type NumericOp = '=' | '>' | '<' | '>=' | '<=';

type Clause =
  | { kind: 'name'; value: string }
  | { kind: 'type'; value: string }
  | { kind: 'color'; letters: readonly string[] }
  | { kind: 'cmc'; op: NumericOp; value: number }
  | { kind: 'power'; op: NumericOp; value: number }
  | { kind: 'toughness'; op: NumericOp; value: number };

export interface CardFilter {
  clauses: readonly Clause[];
  /** Raw input, kept for debugging / re-display. */
  raw: string;
}

/** Splits input into whitespace-separated tokens, honoring "double quotes"
 *  so `"foo bar"` reads as one token with the quotes stripped. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }
    if (ch === '"') {
      // Quoted token — read to the next unescaped quote (or EOF).
      i++;
      let buf = '';
      while (i < input.length && input[i] !== '"') {
        buf += input[i];
        i++;
      }
      if (i < input.length) {
        i++; // skip closing quote
      }
      tokens.push(buf);
      continue;
    }
    // Unquoted token — read until whitespace.
    let buf = '';
    while (i < input.length && input[i] !== ' ' && input[i] !== '\t' && input[i] !== '\n') {
      buf += input[i];
      i++;
    }
    tokens.push(buf);
  }
  return tokens;
}

function parseNumericValue(raw: string): { op: NumericOp; value: number } | null {
  let op: NumericOp = '=';
  let rest = raw;
  if (rest.startsWith('>=')) {
    op = '>=';
    rest = rest.slice(2);
  } else if (rest.startsWith('<=')) {
    op = '<=';
    rest = rest.slice(2);
  } else if (rest.startsWith('>')) {
    op = '>';
    rest = rest.slice(1);
  } else if (rest.startsWith('<')) {
    op = '<';
    rest = rest.slice(1);
  } else if (rest.startsWith('=')) {
    op = '=';
    rest = rest.slice(1);
  }
  const n = Number(rest);
  if (!Number.isFinite(n)) {
    return null;
  }
  return { op, value: n };
}

function parseClause(token: string): Clause | null {
  const colon = token.indexOf(':');
  if (colon < 0) {
    // Bare token → name substring.
    return { kind: 'name', value: token.toLowerCase() };
  }
  const field = token.slice(0, colon).toLowerCase();
  const value = token.slice(colon + 1);
  if (!value) {
    return null;
  }
  switch (field) {
    case 'name':
    case 'n':
      return { kind: 'name', value: value.toLowerCase() };
    case 'type':
    case 't':
      return { kind: 'type', value: value.toLowerCase() };
    case 'color':
    case 'c': {
      // Each char is a required color letter (W/U/B/R/G/C).
      const letters = value.toUpperCase().split('').filter((c) => 'WUBRGC'.includes(c));
      if (letters.length === 0) {
        return null;
      }
      return { kind: 'color', letters };
    }
    case 'cmc':
    case 'mv': {
      const parsed = parseNumericValue(value);
      return parsed ? { kind: 'cmc', ...parsed } : null;
    }
    case 'pow':
    case 'p': {
      const parsed = parseNumericValue(value);
      return parsed ? { kind: 'power', ...parsed } : null;
    }
    case 'tou':
    case 'tough': {
      const parsed = parseNumericValue(value);
      return parsed ? { kind: 'toughness', ...parsed } : null;
    }
    default:
      // Unknown field — silently ignore rather than error out. Keeps the
      // filter forgiving so a typo doesn't drop the whole query.
      return null;
  }
}

export function parseCardFilter(input: string): CardFilter {
  const tokens = tokenize(input);
  const clauses: Clause[] = [];
  for (const tok of tokens) {
    const clause = parseClause(tok);
    if (clause) {
      clauses.push(clause);
    }
  }
  return { clauses, raw: input };
}

function compareNumeric(op: NumericOp, a: number, b: number): boolean {
  switch (op) {
    case '=': return a === b;
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
  }
}

/** Parses a power / toughness cell. `*`, `X`, etc. become 0 — same choice
 *  Cockatrice makes so numeric compares don't NaN on non-numeric PT. */
function parsePTCell(cell: string | undefined): number {
  if (!cell) {
    return 0;
  }
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

function evalClause(clause: Clause, card: FilterableCard): boolean {
  switch (clause.kind) {
    case 'name':
      return card.name.toLowerCase().includes(clause.value);
    case 'type':
      return (card.typeLine ?? '').toLowerCase().includes(clause.value);
    case 'color': {
      const cardColors = (card.colors ?? []).map((c) => c.toUpperCase());
      return clause.letters.every((letter) => cardColors.includes(letter));
    }
    case 'cmc':
      return card.cmc != null && compareNumeric(clause.op, card.cmc, clause.value);
    case 'power':
      return card.power != null && compareNumeric(clause.op, parsePTCell(card.power), clause.value);
    case 'toughness':
      return card.toughness != null && compareNumeric(clause.op, parsePTCell(card.toughness), clause.value);
  }
}

export function matchCard(filter: CardFilter, card: FilterableCard): boolean {
  // All clauses AND'd. An empty filter matches everything.
  for (const clause of filter.clauses) {
    if (!evalClause(clause, card)) {
      return false;
    }
  }
  return true;
}

/** True when the filter has at least one active clause. Used to reject an
 *  otherwise-empty query at submit time (would match everything → infinite
 *  reveal loop). */
export function isFilterEmpty(filter: CardFilter): boolean {
  return filter.clauses.length === 0;
}
