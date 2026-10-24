import { AriaRole, CSSProperties, ReactNode, Ref } from 'react';
import { List, ListImperativeAPI, ListProps, RowComponentProps } from 'react-window';

import './VirtualList.css';

type RenderRow<T> = (item: T, index: number, style: CSSProperties) => ReactNode;

interface VirtualRowsData<T> {
  items: T[];
  renderRow: RenderRow<T>;
  listItems: boolean;
}

interface VirtualRowsProps<T> {
  items: T[];
  rowHeight: number | ((index: number, data: VirtualRowsData<T>) => number);
  className?: string;
  renderRow: RenderRow<T>;
  role?: AriaRole;
  'aria-label'?: string;
  defaultHeight?: number;
  listRef?: Ref<ListImperativeAPI>;
  onRowsRendered?: ListProps<VirtualRowsData<T>>['onRowsRendered'];
}

function RowsRow<T>({ ariaAttributes, index, style, items, renderRow, listItems }: RowComponentProps<VirtualRowsData<T>>) {
  if (!listItems) {
    return <>{renderRow(items[index], index, style)}</>;
  }
  return <div style={style} {...ariaAttributes}>{renderRow(items[index], index, style)}</div>;
}

export function VirtualRows<T>({
  items, rowHeight, className = '', renderRow, role, listRef, onRowsRendered, ...listProps
}: VirtualRowsProps<T>) {
  return (
    <div className="virtual-list">
      <List<VirtualRowsData<T>>
        {...listProps}
        className={`virtual-list__list ${className}`}
        {...(role ? { role } : {})}
        listRef={listRef}
        onRowsRendered={onRowsRendered}
        rowCount={items.length}
        rowHeight={rowHeight}
        rowComponent={RowsRow}
        rowProps={{ items, renderRow, listItems: !role }}
      />
    </div>
  );
}

const renderNode = (node: ReactNode): ReactNode => node;

interface VirtualListProps {
  items: ReactNode[];
  className?: string;
  size?: number;
}

const VirtualList = ({ items, className = '', size = 30 }: VirtualListProps) => (
  <VirtualRows items={items} rowHeight={size} className={className} renderRow={renderNode} />
);

export default VirtualList;
