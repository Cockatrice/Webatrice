import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { useGridRows, type GridRowsOptions } from './useGridRows';

const KEYS = ['a', 'b', 'c'];

function Grid(props: Partial<GridRowsOptions>) {
  const [selected, setSelected] = useState<string | null>(null);
  const keys = props.keys ?? KEYS;
  const rows = useGridRows({ keys, selectedKey: selected, onSelect: setSelected, onActivate: vi.fn(), ...props });
  return (
    <div role="grid">
      {keys.map((key) => (
        <div key={key} role="row" aria-selected={key === selected} data-testid={key} {...rows.getRowProps(key)}>
          <button type="button">{key}</button>
        </div>
      ))}
    </div>
  );
}

describe('useGridRows', () => {
  it('keeps a single tab stop, on the first row until a row is selected', () => {
    render(<Grid />);
    expect(KEYS.map((key) => screen.getByTestId(key).tabIndex)).toEqual([0, -1, -1]);

    fireEvent.keyDown(screen.getByTestId('a'), { key: 'End' });
    expect(KEYS.map((key) => screen.getByTestId(key).tabIndex)).toEqual([-1, -1, 0]);
    expect(screen.getByTestId('c')).toHaveFocus();
  });

  it('moves selection and focus with the arrows and stops at the ends', () => {
    render(<Grid />);
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowUp' });
    expect(screen.getByTestId('a')).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowDown' });
    expect(screen.getByTestId('b')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('b'), { key: 'Home' });
    expect(screen.getByTestId('a')).toHaveAttribute('aria-selected', 'true');
  });

  it('selects on Home and End even when the focused row is already the target', () => {
    const onSelect = vi.fn();
    render(<Grid onSelect={onSelect} />);

    expect(fireEvent.keyDown(screen.getByTestId('a'), { key: 'Home' })).toBe(false);
    fireEvent.keyDown(screen.getByTestId('c'), { key: 'End' });
    expect(onSelect.mock.calls.map(([key]) => key)).toEqual(['a', 'c']);
  });

  it('pages ten rows with PageDown and PageUp, stopping at the ends', () => {
    const onSelect = vi.fn();
    const keys = Array.from({ length: 15 }, (_, i) => `row-${i}`);
    render(<Grid keys={keys} onSelect={onSelect} />);

    expect(fireEvent.keyDown(screen.getByTestId('row-2'), { key: 'PageDown' })).toBe(false);
    expect(screen.getByTestId('row-12')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('row-12'), { key: 'PageDown' });
    fireEvent.keyDown(screen.getByTestId('row-14'), { key: 'PageUp' });
    fireEvent.keyDown(screen.getByTestId('row-0'), { key: 'PageUp' });
    expect(onSelect.mock.calls.map(([key]) => key)).toEqual(['row-12', 'row-14', 'row-4']);
  });

  it('selects on Space, opens on Enter and leaves keys from inner controls alone', () => {
    const onActivate = vi.fn();
    render(<Grid onActivate={onActivate} />);

    fireEvent.keyDown(screen.getByTestId('b'), { key: ' ' });
    expect(screen.getByTestId('b')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByTestId('b'), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith('b');

    fireEvent.keyDown(screen.getByRole('button', { name: 'c' }), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('focuses a moved-to row that mounts only after the move, as in a virtualized list', () => {
    function OneRowGrid() {
      const [selected, setSelected] = useState<string | null>('a');
      const rows = useGridRows({ keys: KEYS, selectedKey: selected, onSelect: setSelected, onActivate: vi.fn() });
      const [shown, setShown] = useState('a');
      return (
        <div role="grid">
          <div key={shown} role="row" data-testid={shown} {...rows.getRowProps(shown)} />
          <button type="button" onClick={() => setShown(selected ?? 'a')}>scroll</button>
        </div>
      );
    }
    render(<OneRowGrid />);

    fireEvent.keyDown(screen.getByTestId('a'), { key: 'End' });
    expect(screen.queryByTestId('c')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'scroll' }));
    expect(screen.getByTestId('c')).toHaveFocus();
  });

  it('hands ← and → to tree callbacks only when given', () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { unmount } = render(<Grid />);
    expect(fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowRight' })).toBe(true);
    unmount();

    render(<Grid onExpand={onExpand} onCollapse={onCollapse} />);
    expect(fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowRight' })).toBe(false);
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowLeft' });
    expect(onExpand).toHaveBeenCalledWith('a');
    expect(onCollapse).toHaveBeenCalledWith('a');
  });
  it('re-homes the tab stop to the first visible row while the selected row is scrolled out of a window', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    let report: (visible: [number, number], all: [number, number]) => void = () => {};
    function WindowedGrid() {
      const [window, setWindow] = useState<[number, number]>([0, 1]);
      const rows = useGridRows({ keys, selectedKey: 'a', onSelect: vi.fn(), onActivate: vi.fn() });
      report = (visible, all) => {
        setWindow(all);
        rows.onRowsRendered({ startIndex: visible[0], stopIndex: visible[1] }, { startIndex: all[0], stopIndex: all[1] });
      };
      return (
        <div role="grid">
          {keys.slice(window[0], window[1] + 1).map((key) => (
            <div key={key} role="row" data-testid={key} {...rows.getRowProps(key)} />
          ))}
        </div>
      );
    }
    render(<WindowedGrid />);
    act(() => report([0, 0], [0, 1]));
    expect(screen.getByTestId('a').tabIndex).toBe(0);

    act(() => report([2, 3], [1, 4]));
    expect(screen.queryByTestId('a')).not.toBeInTheDocument();
    expect(screen.getByTestId('c').tabIndex).toBe(0);
    expect(['b', 'd', 'e'].map((key) => screen.getByTestId(key).tabIndex)).toEqual([-1, -1, -1]);

    act(() => report([0, 1], [0, 2]));
    expect(screen.getByTestId('a').tabIndex).toBe(0);
    expect(screen.getByTestId('b').tabIndex).toBe(-1);
  });
  it('walks a row of items with ← and →, leaving ↑ and ↓ alone', () => {
    const onSelect = vi.fn();
    render(<Grid orientation="horizontal" onSelect={onSelect} />);

    expect(fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowDown' })).toBe(true);
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowRight' });
    expect(screen.getByTestId('b')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('b'), { key: 'ArrowLeft' });
    expect(onSelect.mock.calls.map(([key]) => key)).toEqual(['b', 'a']);
  });

  it('moves within a line along it and to the nearest place in the next non-empty line across it', () => {
    const keys = ['a1', 'a2', 'a3', 'c1'];
    const lines = [['a1', 'a2', 'a3'], [], ['c1']];
    const onSelect = vi.fn();
    render(<Grid keys={keys} lines={lines} orientation="horizontal" onSelect={onSelect} />);

    fireEvent.keyDown(screen.getByTestId('a1'), { key: 'End' });
    expect(screen.getByTestId('a3')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('a3'), { key: 'ArrowDown' });
    expect(screen.getByTestId('c1')).toHaveFocus();
    expect(fireEvent.keyDown(screen.getByTestId('c1'), { key: 'ArrowDown' })).toBe(false);
    fireEvent.keyDown(screen.getByTestId('c1'), { key: 'ArrowUp' });
    expect(onSelect.mock.calls.map(([key]) => key)).toEqual(['a3', 'c1', 'a1']);
  });

  it('extends the selection with Shift and a navigation key when the list takes multi-selection', () => {
    const onSelect = vi.fn();
    const onExtend = vi.fn();
    render(<Grid onSelect={onSelect} onExtend={onExtend} />);

    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowDown', shiftKey: true });
    expect(screen.getByTestId('b')).toHaveFocus();
    expect(onExtend).toHaveBeenCalledWith('b');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('moves focus alone with Ctrl and a navigation key only when asked to', () => {
    const onSelect = vi.fn();
    const { unmount } = render(<Grid onSelect={onSelect} />);
    act(() => screen.getByTestId('a').focus());
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowDown', ctrlKey: true });
    expect(screen.getByTestId('a')).toHaveFocus();
    unmount();

    render(<Grid onSelect={onSelect} focusOnlyWithCtrl />);
    act(() => screen.getByTestId('a').focus());
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'ArrowDown', ctrlKey: true });
    expect(screen.getByTestId('b')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('b'), { key: 'End', ctrlKey: true });
    expect(screen.getByTestId('c')).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hands focus to the next row when the focused row leaves, or the previous at the end', () => {
    function Shrinking({ keep }: { keep: boolean }) {
      const [keys, setKeys] = useState(['a', 'b', 'c']);
      const rows = useGridRows({ keys, selectedKey: null, onSelect: vi.fn(), onActivate: vi.fn(), keepFocusOnRemoval: keep });
      return (
        <div role="grid">
          {keys.map((key) => (
            <div key={key} role="row" data-testid={key} {...rows.getRowProps(key)}>
              <button type="button" onClick={() => setKeys((k) => k.filter((x) => x !== key))}>{`remove ${key}`}</button>
            </div>
          ))}
        </div>
      );
    }
    const { unmount } = render(<Shrinking keep />);
    act(() => screen.getByTestId('b').focus());
    fireEvent.click(screen.getByRole('button', { name: 'remove b' }));
    expect(screen.getByTestId('c')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'remove c' }));
    expect(screen.getByTestId('a')).toHaveFocus();
    unmount();

    render(<Shrinking keep={false} />);
    act(() => screen.getByTestId('b').focus());
    fireEvent.click(screen.getByRole('button', { name: 'remove b' }));
    expect(document.body).toHaveFocus();
  });

  it('moves focus where the caller says when the last row leaves, asking while the row is still in the page', async () => {
    const connected: boolean[] = [];
    function Emptying() {
      const [keys, setKeys] = useState(['a']);
      const rows = useGridRows({
        keys,
        selectedKey: null,
        onSelect: vi.fn(),
        onActivate: vi.fn(),
        keepFocusOnRemoval: (removed) => {
          connected.push(removed.isConnected);
          return document.getElementById('after');
        },
      });
      return (
        <>
          <div role="grid">
            {keys.map((key) => (
              <div key={key} role="row" data-testid={key} {...rows.getRowProps(key)}>
                <button type="button" onClick={() => setKeys([])}>{`remove ${key}`}</button>
              </div>
            ))}
          </div>
          <button type="button" id="after">after</button>
        </>
      );
    }
    render(<Emptying />);
    act(() => screen.getByTestId('a').focus());
    fireEvent.click(screen.getByRole('button', { name: 'remove a' }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(connected).toEqual([true]);
  });
});
