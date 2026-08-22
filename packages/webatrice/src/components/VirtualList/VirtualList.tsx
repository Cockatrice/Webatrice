import { ReactNode } from 'react';
import { List, RowComponentProps } from 'react-window';

import './VirtualList.css';

interface RowData {
  items: ReactNode[];
}

interface VirtualListProps {
  items: ReactNode[];
  className?: string;
  size?: number;
}

const Row = ({ index, style, items }: RowComponentProps<RowData>) => (
  <div style={style}>
    {items[index]}
  </div>
);

const VirtualList = ({ items, className = '', size = 30 }: VirtualListProps) => (
  <div className="virtual-list">
    <List<RowData>
      className={`virtual-list__list ${className}`}
      rowCount={items.length}
      rowHeight={size}
      rowComponent={Row}
      rowProps={{ items }}
    />
  </div>
);

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
 * Render-prop variant of VirtualList: rows are built lazily for the visible
 * window only, so a busy server's thousands of games/users cost O(viewport)
 * per delta frame instead of O(collection). Prefer this over VirtualList for
 * large live collections — prebuilding `items: ReactNode[]` is itself O(N).
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

export default VirtualList;
