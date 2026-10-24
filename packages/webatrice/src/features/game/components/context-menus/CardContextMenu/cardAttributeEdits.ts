
export function parsePT(pt: string): (number | string)[] {
  if (!pt) {
    return [];
  }
  // Leading '/' is a Cockatrice special-case: treat the rest as one
  // opaque string token. Preserves inputs like "/foo".
  if (pt.startsWith('/')) {
    return [pt.slice(1)];
  }
  return pt.split('/').map((item) => {
    if (item.length === 0) {
      return '';
    }
    if (item[0] === '+') {
      return parseInt(item.slice(1), 10) || 0;
    }
    if (item[0] === '-') {
      return parseInt(item, 10) || 0;
    }
    return item;
  });
}

/** Extracts the numeric value from a parsed PT token. String tokens like
 *  "2" parse as 2; opaque strings ("*") parse as 0. Mirrors Cockatrice
 *  which does the same via QVariant::toInt on the QVariantList. */
export function ptTokenToInt(token: number | string): number {
  if (typeof token === 'number') {
    return token;
  }
  const n = parseInt(token, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Port of `PlayerActions::actIncPT(cards, deltaP, deltaT)`. Applies a
 *  per-card power/toughness delta and returns the resulting wire string.
 *  Matches Cockatrice's three cases: empty PT, single-token PT (power
 *  only), and multi-token PT (power/toughness). */
export function applyPTDelta(currentPt: string, deltaP: number, deltaT: number): string {
  const list = parsePT(currentPt);
  const tSuffix = deltaT ? `/${deltaT}` : '';
  if (list.length === 0) {
    return `${deltaP}${tSuffix}`;
  }
  if (list.length === 1) {
    return `${ptTokenToInt(list[0]) + deltaP}${tSuffix}`;
  }
  return `${ptTokenToInt(list[0]) + deltaP}/${ptTokenToInt(list[1]) + deltaT}`;
}

/** Port of `PlayerActions::actSetPT(cards, pt)`. The input string is a
 *  mini-DSL: numeric tokens replace, `+N`/`-N` tokens adjust the same
 *  position on the current PT. Empty input clears the PT. */
export function applyPTSet(currentPt: string, input: string): string {
  const inputList = parsePT(input);
  if (inputList.length === 0) {
    return '';
  }
  const oldList = parsePT(currentPt);
  return inputList
    .map((item, i) => {
      if (typeof item === 'number') {
        const old = i < oldList.length ? ptTokenToInt(oldList[i]) : 0;
        return String(old + item);
      }
      return item;
    })
    .join('/');
}
