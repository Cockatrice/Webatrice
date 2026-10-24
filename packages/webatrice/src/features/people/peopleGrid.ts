export const GRID_MIN_COLUMN_PX = 230;
export const GRID_MAX_COLUMNS = 3;

export function gridColumns(width: number, items: number): number {
  const fit = Number.isFinite(width) ? Math.floor(width / GRID_MIN_COLUMN_PX) : GRID_MAX_COLUMNS;
  return Math.max(1, Math.min(GRID_MAX_COLUMNS, fit, items));
}

export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
