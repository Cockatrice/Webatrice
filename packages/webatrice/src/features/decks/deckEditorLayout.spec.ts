import {
  COLLAPSED_PANE_WIDTH,
  DECK_LIST_MIN_WIDTH,
  DEFAULT_DECK_EDITOR_LAYOUT,
  PANE_LIMITS,
  clampPaneWidth,
  defaultPaneWidth,
  parseLayoutPrefs,
  resolveDeckEditorLayout,
  serializeLayoutPrefs,
  withGroupsCollapsed,
  withPaneCollapsed,
  withPaneWidth,
  type DeckEditorLayoutPrefs,
} from './deckEditorLayout';

const prefs = (overrides: Partial<DeckEditorLayoutPrefs> = {}): DeckEditorLayoutPrefs => ({
  ...DEFAULT_DECK_EDITOR_LAYOUT,
  ...overrides,
});

describe('parseLayoutPrefs', () => {
  it('falls back to the defaults for missing or broken data', () => {
    expect(parseLayoutPrefs(null)).toEqual(DEFAULT_DECK_EDITOR_LAYOUT);
    expect(parseLayoutPrefs('{oops')).toEqual(DEFAULT_DECK_EDITOR_LAYOUT);
    expect(parseLayoutPrefs('[1,2]')).toEqual(DEFAULT_DECK_EDITOR_LAYOUT);
  });

  it('round-trips a saved layout', () => {
    const saved = prefs({
      dockWidth: 340,
      inspectorWidth: 450,
      dockCollapsed: true,
      density: 'compact',
      collapsedGroups: ['Land'],
    });
    expect(parseLayoutPrefs(serializeLayoutPrefs(saved))).toEqual(saved);
  });

  it('clamps stored widths and drops values of the wrong type', () => {
    const parsed = parseLayoutPrefs(JSON.stringify({
      dockWidth: 9999,
      inspectorWidth: 10,
      inspectorCollapsed: 'yes',
      density: 'tiny',
      collapsedGroups: ['Land', 3, 'Land', 'Sideboard'],
    }));
    expect(parsed).toEqual(prefs({
      dockWidth: PANE_LIMITS.dock.max,
      inspectorWidth: PANE_LIMITS.inspector.min,
      collapsedGroups: ['Land', 'Sideboard'],
    }));
  });
});

describe('resolveDeckEditorLayout', () => {
  it('docks both panes with their defaults on a 1440 wide window', () => {
    const layout = resolveDeckEditorLayout(DEFAULT_DECK_EDITOR_LAYOUT, 1364);
    expect(layout).toMatchObject({ dockWidth: 300, inspectorWidth: defaultPaneWidth('inspector', 1364), inspectorDocked: true });
    expect(1364 - layout.dockWidth - layout.inspectorWidth).toBeGreaterThanOrEqual(DECK_LIST_MIN_WIDTH);
  });

  it('still docks the inspector on a 1280 wide window', () => {
    const layout = resolveDeckEditorLayout(DEFAULT_DECK_EDITOR_LAYOUT, 1204);
    expect(layout.inspectorDocked).toBe(true);
    expect(1204 - layout.dockWidth - layout.inspectorWidth).toBeGreaterThanOrEqual(DECK_LIST_MIN_WIDTH);
  });

  it('turns the inspector into an overlay when the deck list would get too narrow', () => {
    const layout = resolveDeckEditorLayout(DEFAULT_DECK_EDITOR_LAYOUT, 960);
    expect(layout.inspectorDocked).toBe(false);
    expect(layout.dockWidth).toBe(300);
  });

  it('docks again on a narrow window once Find cards is collapsed', () => {
    const layout = resolveDeckEditorLayout(prefs({ dockCollapsed: true }), 960);
    expect(layout).toMatchObject({ dockWidth: COLLAPSED_PANE_WIDTH, inspectorDocked: true });
    expect(960 - layout.dockWidth - layout.inspectorWidth).toBeGreaterThanOrEqual(DECK_LIST_MIN_WIDTH);
  });

  it('shrinks remembered widths that no longer fit, keeping the deck list usable', () => {
    const layout = resolveDeckEditorLayout(prefs({ dockWidth: 520, inspectorWidth: 600 }), 1204);
    expect(1204 - layout.dockWidth - layout.inspectorWidth).toBe(DECK_LIST_MIN_WIDTH);
    expect(layout.dockWidth).toBeGreaterThanOrEqual(PANE_LIMITS.dock.min);
    expect(layout.inspectorWidth).toBeGreaterThanOrEqual(PANE_LIMITS.inspector.min);
  });

  it('limits how far each pane can grow by the room the other leaves', () => {
    const layout = resolveDeckEditorLayout(DEFAULT_DECK_EDITOR_LAYOUT, 1364);
    expect(layout.dockRange).toEqual({ min: PANE_LIMITS.dock.min, max: 1364 - DECK_LIST_MIN_WIDTH - layout.inspectorWidth });
    expect(layout.inspectorRange).toEqual({ min: PANE_LIMITS.inspector.min, max: 1364 - DECK_LIST_MIN_WIDTH - 300 });
    const wide = resolveDeckEditorLayout(DEFAULT_DECK_EDITOR_LAYOUT, 2400);
    expect(wide.dockRange.max).toBe(PANE_LIMITS.dock.max);
    expect(wide.inspectorRange.max).toBe(PANE_LIMITS.inspector.max);
  });

  it('gives a collapsed pane the rail width', () => {
    const layout = resolveDeckEditorLayout(prefs({ dockCollapsed: true, inspectorCollapsed: true }), 1364);
    expect(layout).toMatchObject({ dockWidth: COLLAPSED_PANE_WIDTH, inspectorWidth: COLLAPSED_PANE_WIDTH, inspectorDocked: true });
  });
});

describe('layout updates', () => {
  it('clamps a width into a range', () => {
    expect(clampPaneWidth(100.4, { min: 260, max: 500 })).toBe(260);
    expect(clampPaneWidth(333.6, { min: 260, max: 500 })).toBe(334);
    expect(clampPaneWidth(900, { min: 260, max: 500 })).toBe(500);
  });

  it('sets and resets one pane width', () => {
    const wide = withPaneWidth(DEFAULT_DECK_EDITOR_LAYOUT, 'inspector', 480);
    expect(wide).toMatchObject({ dockWidth: null, inspectorWidth: 480 });
    expect(withPaneWidth(wide, 'inspector', null)).toEqual(DEFAULT_DECK_EDITOR_LAYOUT);
  });

  it('collapses a pane and keeps the same object when nothing changes', () => {
    expect(withPaneCollapsed(DEFAULT_DECK_EDITOR_LAYOUT, 'dock', true).dockCollapsed).toBe(true);
    expect(withPaneCollapsed(DEFAULT_DECK_EDITOR_LAYOUT, 'dock', false)).toBe(DEFAULT_DECK_EDITOR_LAYOUT);
  });

  it('collapses and expands groups without duplicates', () => {
    const collapsed = withGroupsCollapsed(prefs({ collapsedGroups: ['Land'] }), ['Land', 'Creature'], true);
    expect(collapsed.collapsedGroups).toEqual(['Land', 'Creature']);
    expect(withGroupsCollapsed(collapsed, ['Land'], false).collapsedGroups).toEqual(['Creature']);
  });
});
