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
 * Windowed list: rows are built lazily for the visible window only, so a busy
 * server's thousands of games/users cost O(viewport) per delta frame instead of
 * O(collection). Prefer this over prebuilding an `items: ReactNode[]` array
 * (itself O(N)) for large live collections. Pass a referentially stable
 * `renderRow` (module-level fn or useCallback) so react-window's row
 * memoization holds across parent re-renders.
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

// Stable module-level identity render so the VirtualList wrapper reuses
// VirtualRows without handing it a fresh renderRow each render (which would
// defeat row memoization).
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
