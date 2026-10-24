export function cardViewRowsHeight(rows: number, cardHeightPx: number): number {
  return ((rows + 1) * cardHeightPx) / 3 + 5;
}

export function toggledCardViewHeight(
  current: number,
  { initial, expanded, maxHeight }: { initial: number; expanded: number; maxHeight: number },
): number {
  const near = (a: number, b: number) => Math.abs(a - b) < 1;
  const reset = current < initial
    || near(current, Math.min(expanded, maxHeight))
    || (near(current, maxHeight) && current > initial && current < expanded);
  return reset ? Math.min(initial, maxHeight) : Math.min(expanded, maxHeight);
}
