export const MANA_TOKEN_RE = /\{[^}]+\}/g;

const SINGLE_TOKEN_RE = /^\{[^}]+\}$/;

export function isManaToken(s: string): boolean {
  return SINGLE_TOKEN_RE.test(s);
}

export function manaCostTokens(cost: string): string[] {
  return cost.match(MANA_TOKEN_RE) ?? [];
}
