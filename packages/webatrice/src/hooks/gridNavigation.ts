
export const GRID_PAGE_ROWS = 10;

export type ListOrientation = 'vertical' | 'horizontal';

export function listArrows(orientation: ListOrientation): { next: string; previous: string } {
  return orientation === 'horizontal'
    ? { next: 'ArrowRight', previous: 'ArrowLeft' }
    : { next: 'ArrowDown', previous: 'ArrowUp' };
}

export function navigationTarget(
  key: string,
  index: number | null,
  count: number,
  orientation: ListOrientation = 'vertical',
): number | null {
  if (count === 0) {
    return null;
  }
  const last = count - 1;
  const from = index === null ? -1 : Math.min(index, last);
  const arrows = listArrows(orientation);
  switch (key) {
    case arrows.next: return Math.min(from + 1, last);
    case arrows.previous: return from < 0 ? 0 : Math.max(from - 1, 0);
    case 'Home': return 0;
    case 'End': return last;
    case 'PageDown': return Math.min(Math.max(from, 0) + GRID_PAGE_ROWS, last);
    case 'PageUp': return Math.max(from - GRID_PAGE_ROWS, 0);
    default: return null;
  }
}

export const isSelectKey = (key: string) => key === ' ' || key === 'Enter';
