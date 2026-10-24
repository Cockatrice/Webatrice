import { act, renderHook } from '@testing-library/react';

import { DECK_LAYOUT_STORAGE_KEY, DECK_LIST_MIN_WIDTH, PANE_LIMITS } from '../deckEditorLayout';
import { useDeckEditorLayout } from './useDeckEditorLayout';

function measured(width: number) {
  const node = document.createElement('div');
  node.getBoundingClientRect = () => ({ width } as DOMRect);
  return node;
}

function renderLayout(width = 1364) {
  const hook = renderHook(() => useDeckEditorLayout());
  act(() => hook.result.current.containerRef(measured(width)));
  return hook;
}

const stored = () => JSON.parse(window.localStorage.getItem(DECK_LAYOUT_STORAGE_KEY) ?? 'null');

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useDeckEditorLayout', () => {
  it('measures its container and docks both panes when there is room', () => {
    const { result } = renderLayout(1204);
    expect(result.current.containerWidth).toBe(1204);
    expect(result.current.layout.inspectorDocked).toBe(true);
  });

  it('clamps a dragged width to what leaves the deck list usable, and remembers it', () => {
    const { result } = renderLayout();
    act(() => result.current.setPaneWidth('dock', 900));
    const { dockWidth, inspectorWidth } = result.current.layout;
    expect(1364 - dockWidth - inspectorWidth).toBe(DECK_LIST_MIN_WIDTH);
    expect(stored().dockWidth).toBe(dockWidth);

    act(() => result.current.setPaneWidth('dock', 10));
    expect(result.current.layout.dockWidth).toBe(PANE_LIMITS.dock.min);
  });

  it('resizes by a step and resets a pane to its default', () => {
    const { result } = renderLayout();
    const start = result.current.layout.inspectorWidth;
    act(() => result.current.resizePaneBy('inspector', 32));
    expect(result.current.layout.inspectorWidth).toBe(start + 32);
    act(() => result.current.resetPaneWidth('inspector'));
    expect(result.current.layout.inspectorWidth).toBe(start);
    expect(stored().inspectorWidth).toBeNull();
  });

  it('restores the saved layout on the next mount', () => {
    const first = renderLayout();
    act(() => {
      first.result.current.setPaneWidth('inspector', 450);
      first.result.current.setPaneCollapsed('dock', true);
      first.result.current.setDensity('compact');
      first.result.current.setGroupsCollapsed(['Land'], true);
    });
    first.unmount();

    const { result } = renderLayout();
    expect(result.current.prefs).toMatchObject({ inspectorWidth: 450, dockCollapsed: true, density: 'compact' });
    expect(result.current.collapsedGroups.has('Land')).toBe(true);
    expect(result.current.isPaneCollapsed('dock')).toBe(true);
  });

  it('resets every layout choice', () => {
    const { result } = renderLayout();
    act(() => {
      result.current.setPaneWidth('dock', 400);
      result.current.setPaneCollapsed('inspector', true);
      result.current.setDensity('compact');
      result.current.setGroupsCollapsed(['Creature'], true);
    });
    act(() => result.current.reset());
    expect(stored()).toEqual({
      dockWidth: null,
      inspectorWidth: null,
      dockCollapsed: false,
      inspectorCollapsed: false,
      density: 'comfortable',
      collapsedGroups: [],
    });
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderLayout();
    act(() => result.current.setDensity('compact'));
    expect(result.current.prefs.density).toBe('compact');
  });
});
