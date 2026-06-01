import { act, cleanup, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../utils/selection';
import { useGameBoxSelection, type UseGameBoxSelectionArgs } from './useGameBoxSelection';

// A card element with the data-* attrs the hit-test reads, positioned via a
// stubbed getBoundingClientRect.
function makeCard(
  zone: Element,
  { playerId, zoneName, cardId, rect }: {
    playerId: number;
    zoneName: string;
    cardId: number;
    rect: { left: number; top: number; right: number; bottom: number };
  },
): void {
  const el = document.createElement('div');
  el.setAttribute('data-card-id', String(cardId));
  el.setAttribute('data-card-owner', String(playerId));
  el.setAttribute('data-card-zone', zoneName);
  el.getBoundingClientRect = () =>
    ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top, x: rect.left, y: rect.top, toJSON: () => ({}) }) as DOMRect;
  zone.appendChild(el);
}

function makeZone(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-zone-box-select', '');
  document.body.appendChild(el);
  return el;
}

function mouseDownOn(target: Element, init: Partial<MouseEventInit> = {}): React.MouseEvent<HTMLDivElement> {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    shiftKey: false,
    target,
    ...init,
  } as unknown as React.MouseEvent<HTMLDivElement>;
}

function fireMouseMove(clientX: number, clientY: number) {
  // jsdom doesn't reliably honor clientX/clientY via the constructor; set explicitly.
  const ev = new MouseEvent('mousemove', { bubbles: true });
  Object.defineProperty(ev, 'clientX', { value: clientX });
  Object.defineProperty(ev, 'clientY', { value: clientY });
  window.dispatchEvent(ev);
}

function setup(overrides: Partial<UseGameBoxSelectionArgs> = {}) {
  const setSelectedCardKeys = vi.fn();
  const clearSelection = vi.fn();
  const clearFocused = vi.fn();
  const args: UseGameBoxSelectionArgs = {
    selectedCardKeys: EMPTY_SELECTION,
    setSelectedCardKeys,
    clearSelection,
    clearFocused,
    pendingActive: false,
    ...overrides,
  };
  const { result, rerender } = renderHook((a: UseGameBoxSelectionArgs) => useGameBoxSelection(a), {
    initialProps: args,
  });
  return { result, rerender, setSelectedCardKeys, clearSelection, clearFocused };
}

// The last Set the hook pushed to setSelectedCardKeys.
function lastKeys(spy: ReturnType<typeof vi.fn>): Set<string> {
  return spy.mock.calls.at(-1)![0] as Set<string>;
}

describe('useGameBoxSelection', () => {
  afterEach(() => {
    cleanup(); // unmount hooks so their window listeners detach between tests
    document.body.innerHTML = '';
  });

  it('selects only cards in the zone the drag started in (cross-zone scoping)', () => {
    const battlefield = makeZone();
    makeCard(battlefield, { playerId: 1, zoneName: 'table', cardId: 5, rect: { left: 20, top: 20, right: 60, bottom: 80 } });
    // A dialog card occupying the same screen area — must NOT be selected.
    const dialog = makeZone();
    makeCard(dialog, { playerId: 1, zoneName: 'grave', cardId: 9, rect: { left: 20, top: 20, right: 60, bottom: 80 } });

    const { result, setSelectedCardKeys } = setup();
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(battlefield, { clientX: 10, clientY: 10 }));
    });
    act(() => fireMouseMove(200, 200));

    const keys = lastKeys(setSelectedCardKeys);
    expect([...keys]).toEqual([makeCardKey(1, 'table', 5)]);
    expect(keys.has(makeCardKey(1, 'grave', 9))).toBe(false);
  });

  it('unions onto the prior selection when Ctrl is held', () => {
    const battlefield = makeZone();
    makeCard(battlefield, { playerId: 1, zoneName: 'table', cardId: 5, rect: { left: 20, top: 20, right: 60, bottom: 80 } });
    const prior = new Set([makeCardKey(1, 'table', 1)]);

    const { result, setSelectedCardKeys } = setup({ selectedCardKeys: prior });
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(battlefield, { clientX: 10, clientY: 10, ctrlKey: true }));
    });
    act(() => fireMouseMove(200, 200));

    const keys = lastKeys(setSelectedCardKeys);
    expect(keys.has(makeCardKey(1, 'table', 1))).toBe(true);
    expect(keys.has(makeCardKey(1, 'table', 5))).toBe(true);
  });

  it('clears the selection at drag-start for a non-additive press', () => {
    const battlefield = makeZone();
    const { result, clearSelection, clearFocused } = setup();
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(battlefield, { clientX: 10, clientY: 10 }));
    });
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(clearFocused).toHaveBeenCalledTimes(1);
  });

  it('does not start a drag when the press lands on a card', () => {
    const battlefield = makeZone();
    const cardEl = document.createElement('div');
    cardEl.setAttribute('data-card-id', '5');
    battlefield.appendChild(cardEl);

    const { result, clearSelection, setSelectedCardKeys } = setup();
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(cardEl, { clientX: 10, clientY: 10 }));
    });
    act(() => fireMouseMove(200, 200));

    expect(clearSelection).not.toHaveBeenCalled();
    expect(setSelectedCardKeys).not.toHaveBeenCalled();
  });

  it('does not start a drag while an arrow/attach is pending', () => {
    const battlefield = makeZone();
    const { result, clearSelection, setSelectedCardKeys } = setup({ pendingActive: true });
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(battlefield, { clientX: 10, clientY: 10 }));
    });
    act(() => fireMouseMove(200, 200));

    expect(clearSelection).not.toHaveBeenCalled();
    expect(setSelectedCardKeys).not.toHaveBeenCalled();
  });

  it('does not recompute before the movement threshold is crossed', () => {
    const battlefield = makeZone();
    makeCard(battlefield, { playerId: 1, zoneName: 'table', cardId: 5, rect: { left: 20, top: 20, right: 60, bottom: 80 } });
    const { result, setSelectedCardKeys } = setup();
    act(() => {
      result.current.handleGameMouseDown(mouseDownOn(battlefield, { clientX: 10, clientY: 10 }));
    });
    act(() => fireMouseMove(12, 12)); // 2+2 px, below 4px threshold

    expect(setSelectedCardKeys).not.toHaveBeenCalled();
  });

  it('Escape clears the selection, unless a MUI dialog owns the key', () => {
    const { clearSelection: clearA } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(clearA).toHaveBeenCalledTimes(1);

    const dialog = document.createElement('div');
    dialog.className = 'MuiDialog-root';
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    const { clearSelection: clearB } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(clearB).not.toHaveBeenCalled();
  });
});
