export function movePlaymat<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
