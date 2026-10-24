
/**
 * Safely evaluate a basic arithmetic expression the user typed into
 * the set-life modal. Supports `+ - * / %` and parentheses.
 *
 * Input is character-filtered before hitting the Function constructor,
 * so nothing but digits, operators, parens, decimal points, and
 * whitespace can make it into the evaluated string. That means no
 * identifiers (letters), no property access, no function calls — the
 * evaluator can only compute against literal numbers.
 *
 * Returns the truncated integer result, or `null` when the input is
 * empty / non-arithmetic / doesn't produce a finite number.
 */
export function evalLifeExpression(input: string): number | null {
  const stripped = input.replace(/\s+/g, '');
  if (stripped.length === 0) {
    return null;
  }
  if (!/^[-+*/%().0-9]+$/.test(stripped)) {
    return null;
  }
  try {
    const result = new Function(`"use strict"; return (${stripped})`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return null;
    }
    return Math.trunc(result);
  } catch {
    return null;
  }
}
