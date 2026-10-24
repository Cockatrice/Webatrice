import { fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import VirtualList, { VirtualRows } from './VirtualList';

type RoCallback = (entries: { contentRect: { height: number; width: number }; target: Element }[]) => void;

interface RoHandle {
  callback: RoCallback;
  targets: Set<Element>;
}

let observers: RoHandle[] = [];

function emitSize(element: Element, height: number, width = 200) {
  for (const handle of observers) {
    if (handle.targets.has(element)) {
      act(() => {
        handle.callback([{ contentRect: { height, width }, target: element }]);
      });
    }
  }
}

function findListContainer(container: HTMLElement): HTMLElement {
  const node = container.querySelector('.virtual-list__list') as HTMLElement | null;
  if (!node) {
    throw new Error('virtual-list__list element not found');
  }
  return node;
}

describe('VirtualList', () => {
  let originalRo: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    originalRo = globalThis.ResizeObserver;
    observers = [];
    globalThis.ResizeObserver = class {
      private handle: RoHandle;
      constructor(callback: RoCallback) {
        this.handle = { callback, targets: new Set() };
        observers.push(this.handle);
      }
      observe(target: Element) {
        this.handle.targets.add(target);
      }
      unobserve(target: Element) {
        this.handle.targets.delete(target);
      }
      disconnect() {
        this.handle.targets.clear();
      }
    } as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRo;
    observers = [];
  });

  it('mounts only the visible window of rows, not every item', () => {
    const items = Array.from({ length: 200 }, (_, index) => (
      <span data-row-id={index} key={index}>row-{index}</span>
    ));
    const { container } = render(<VirtualList items={items} size={20} />);

    emitSize(findListContainer(container), 100);

    const renderedIds = Array.from(container.querySelectorAll('[data-row-id]'))
      .map((node) => Number(node.getAttribute('data-row-id')));
    expect(renderedIds.length).toBeGreaterThan(0);
    expect(renderedIds.length).toBeLessThan(items.length);
    expect(renderedIds).toContain(0);
    expect(renderedIds).not.toContain(199);
  });

  it('updates the visible window after the container scrolls', () => {
    const items = Array.from({ length: 200 }, (_, index) => (
      <span data-row-id={index} key={index}>row-{index}</span>
    ));
    const { container } = render(<VirtualList items={items} size={20} />);

    const listEl = findListContainer(container);
    emitSize(listEl, 100);

    const beforeIds = Array.from(container.querySelectorAll('[data-row-id]'))
      .map((node) => Number(node.getAttribute('data-row-id')));
    expect(beforeIds).toContain(0);

    act(() => {
      Object.defineProperty(listEl, 'scrollTop', { configurable: true, value: 2000 });
      fireEvent.scroll(listEl);
    });

    const afterIds = Array.from(container.querySelectorAll('[data-row-id]'))
      .map((node) => Number(node.getAttribute('data-row-id')));
    expect(afterIds.some((id) => id >= 90)).toBe(true);
    expect(afterIds).not.toContain(0);
  });

  it('recycles row slots so the rendered count stays bounded as the window moves', () => {
    const items = Array.from({ length: 500 }, (_, index) => (
      <span data-row-id={index} key={index}>row-{index}</span>
    ));
    const { container } = render(<VirtualList items={items} size={20} />);

    const listEl = findListContainer(container);
    emitSize(listEl, 100);

    const initialCount = container.querySelectorAll('[data-row-id]').length;
    const viewportRows = Math.ceil(100 / 20);
    const reasonableCap = viewportRows + 16;

    act(() => {
      Object.defineProperty(listEl, 'scrollTop', { configurable: true, value: 4000 });
      fireEvent.scroll(listEl);
    });

    const afterCount = container.querySelectorAll('[data-row-id]').length;
    expect(initialCount).toBeLessThanOrEqual(reasonableCap);
    expect(afterCount).toBeLessThanOrEqual(reasonableCap);
    expect(afterCount).toBeLessThan(items.length);
  });

  it('renders an empty container without crashing when items is empty', () => {
    const { container } = render(<VirtualList items={[]} />);
    expect(container.querySelector('.virtual-list')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-row-id]').length).toBe(0);
  });

  it('forwards a custom className to the inner list element', () => {
    const items = Array.from({ length: 5 }, (_, index) => (
      <span data-row-id={index} key={index}>row-{index}</span>
    ));
    const { container } = render(<VirtualList items={items} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('does not coerce the default className to "[object Object]"', () => {
    const { container } = render(<VirtualList items={[]} />);
    const list = container.querySelector('.virtual-list__list');
    expect(list?.className).not.toContain('[object Object]');
  });

  it('defaults the scroll container to react-window\'s list role', () => {
    const { container } = render(
      <VirtualRows items={[1, 2, 3]} rowHeight={20} renderRow={(n) => <span>{n}</span>} />,
    );
    expect(container.querySelector('.virtual-list__list')).toHaveAttribute('role', 'list');
  });

  it('overrides the scroll container role when a consumer needs a table body', () => {
    const { container } = render(
      <VirtualRows items={[1]} rowHeight={20} role="rowgroup" renderRow={(n) => <span>{n}</span>} />,
    );
    expect(container.querySelector('.virtual-list__list')).toHaveAttribute('role', 'rowgroup');
  });

  it('makes each row of a plain list a listitem placed in the whole list', () => {
    const { container } = render(
      <VirtualRows items={['a', 'b', 'c']} rowHeight={20} renderRow={(n) => <span>{n}</span>} />,
    );
    emitSize(findListContainer(container), 100);

    const rows = container.querySelectorAll('[role="listitem"]');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveAttribute('aria-posinset', '2');
    expect(rows[1]).toHaveAttribute('aria-setsize', '3');
  });

  it('leaves row semantics to the caller when it sets the list role', () => {
    const { container } = render(
      <VirtualRows items={[1]} rowHeight={20} role="rowgroup" renderRow={(n) => <div role="row">{n}</div>} />,
    );
    emitSize(findListContainer(container), 100);

    expect(container.querySelector('[role="listitem"]')).not.toBeInTheDocument();
    expect(container.querySelector('[role="row"]')).toBeInTheDocument();
  });

  it('renders a caller-roled list\'s rows as its direct children, positioned by the row itself', () => {
    const { container } = render(
      <VirtualRows
        items={[1, 2]}
        rowHeight={20}
        role="rowgroup"
        renderRow={(n, _, style) => <div role="row" style={style}>{n}</div>}
      />,
    );
    emitSize(findListContainer(container), 100);

    const rows = container.querySelectorAll('[role="row"]');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.parentElement).toHaveAttribute('role', 'rowgroup');
    }
    expect((rows[1] as HTMLElement).style.transform).toContain('20px');
  });
});
