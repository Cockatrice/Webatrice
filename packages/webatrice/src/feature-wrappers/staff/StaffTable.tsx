import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { useGridRows } from '@app/hooks';
import { cx } from '@app/utils';

import { nextSort, sortRows, type SortValue, type TableSort } from './staffTableSort';

export interface StaffColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right';
  sortValue?: (row: T) => SortValue;
  className?: string;
}

interface StaffTableProps<T> {
  label: string;
  columns: StaffColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onEscape?: () => void;
  rowTestId?: (row: T) => string;
  status?: ReactNode;
  footer?: ReactNode;
  className?: string;
  tableClassName?: string;
}

const rowFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

const headerCell = 'h-9 truncate whitespace-nowrap px-3 align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted';

export default function StaffTable<T>({
  label,
  columns,
  rows,
  rowKey,
  selectedKey = null,
  onSelect,
  onEscape,
  rowTestId,
  status,
  footer,
  className,
  tableClassName,
}: StaffTableProps<T>) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const sorted = useMemo(() => {
    if (!sort) {
      return rows;
    }
    return sortRows(rows, columns.find((c) => c.id === sort.column)?.sortValue, sort.ascending);
  }, [rows, columns, sort]);

  const selectable = Boolean(onSelect);
  const select = onSelect ?? (() => undefined);
  const grid = useGridRows({
    keys: selectable ? sorted.map(rowKey) : [],
    selectedKey,
    onSelect: select,
    onActivate: select,
  });

  const rowProps = (key: string) => {
    const props = grid.getRowProps(key);
    return {
      ...props,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape' && onEscape) {
          event.stopPropagation();
          onEscape();
          return;
        }
        props.onKeyDown(event);
      },
    };
  };

  return (
    <div className={cx('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="min-h-0 overflow-auto">
        <table
          className={cx('w-full table-fixed border-collapse text-left', tableClassName)}
          role={selectable ? 'grid' : undefined}
          aria-label={label}
        >
          <colgroup>
            {columns.map((column) => <col key={column.id} className={column.width} />)}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-bg-base">
            <tr className="border-b border-border-subtle">
              {columns.map((column) => {
                const sortedBy = sort?.column === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cx(headerCell, column.align === 'right' && 'text-right')}
                    aria-sort={sortedBy ? (sort.ascending ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort((previous) => nextSort(previous, column.id))}
                        className={cx(
                          'inline-flex items-center gap-1 rounded-ui-sm uppercase hover:text-text-primary',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {sortedBy && (sort.ascending ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {status ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-3 text-[13px] text-text-muted">{status}</td>
              </tr>
            ) : sorted.map((row) => {
              const key = rowKey(row);
              const selected = selectable && key === selectedKey;
              return (
                <tr
                  key={key}
                  {...(selectable ? rowProps(key) : {})}
                  aria-selected={selectable ? selected : undefined}
                  data-testid={rowTestId?.(row)}
                  onClick={selectable ? () => select(key) : undefined}
                  className={cx(
                    'h-row border-b border-border-subtle text-[13px] text-text-primary',
                    selectable && 'cursor-pointer',
                    selectable && rowFocus,
                    selected ? 'bg-accent/10 shadow-[inset_3px_0_0_rgb(var(--accent-primary))]' : 'hover:bg-bg-elevated/60',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cx('truncate px-3 align-middle', column.align === 'right' && 'text-right tabular-nums', column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="shrink-0 px-5 py-3 text-[12px] text-text-muted">{footer}</div>}
    </div>
  );
}
