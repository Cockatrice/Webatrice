import { ReactNode } from 'react';
import { List, RowComponentProps } from 'react-window';

import './VirtualList.css';

interface VirtualRowsData<T> {
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
}

interface VirtualRowsProps<T> {
  items: T[];
  rowHeight: number;
  className?: string;
  renderRow: (item: T, index: number) => ReactNode;
}

function RowsRow<T>({ index, style, items, renderRow }: RowComponentProps<VirtualRowsData<T>>) {
  return <div style={style}>{renderRow(items[index], index)}</div>;
}

/**
 * Windowed list for large live collections — rows built lazily for the visible
 * window only. Pass a referentially stable `renderRow`. See
 * webatrice.instructions.md § Virtualized lists for when to prefer this and why.
 */
export function VirtualRows<T>({ items, rowHeight, className = '', renderRow }: VirtualRowsProps<T>) {
  return (
    <div className="virtual-list">
      <List<VirtualRowsData<T>>
        className={`virtual-list__list ${className}`}
        rowCount={items.length}
        rowHeight={rowHeight}
        rowComponent={RowsRow}
        rowProps={{ items, renderRow }}
      />
    </div>
  );
}

// Module-level so the renderRow identity stays stable across renders (row
// memoization) — see webatrice.instructions.md § Virtualized lists.
const renderNode = (node: ReactNode): ReactNode => node;

interface VirtualListProps {
  items: ReactNode[];
  className?: string;
  size?: number;
}

/** Thin wrapper for callers that already hold a prebuilt `ReactNode[]`. */
const VirtualList = ({ items, className = '', size = 30 }: VirtualListProps) => (
  <VirtualRows items={items} rowHeight={size} className={className} renderRow={renderNode} />
);

export default VirtualList;
