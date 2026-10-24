export type SortValue = number | string | bigint;

export interface TableSort {
  column: string;
  ascending: boolean;
}

export function nextSort(previous: TableSort | null, column: string): TableSort {
  return previous?.column === column ? { column, ascending: !previous.ascending } : { column, ascending: true };
}

export function sortRows<T>(rows: readonly T[], value: ((row: T) => SortValue) | undefined, ascending: boolean): T[] {
  if (!value) {
    return [...rows];
  }
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return ascending ? cmp : -cmp;
  });
}
