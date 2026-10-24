export type DeckPane = 'dock' | 'inspector';
export type DeckRowDensity = 'comfortable' | 'compact';

export interface DeckEditorLayoutPrefs {
  dockWidth: number | null;
  inspectorWidth: number | null;
  dockCollapsed: boolean;
  inspectorCollapsed: boolean;
  density: DeckRowDensity;
  collapsedGroups: string[];
}

export interface PaneRange {
  min: number;
  max: number;
}

export interface ResolvedDeckEditorLayout {
  dockWidth: number;
  inspectorWidth: number;
  inspectorDocked: boolean;
  dockRange: PaneRange;
  inspectorRange: PaneRange;
}

export const DECK_LAYOUT_STORAGE_KEY = 'webatrice.deckEditorLayout';
export const PANE_LIMITS: Record<DeckPane, PaneRange> = {
  dock: { min: 260, max: 560 },
  inspector: { min: 280, max: 640 },
};
export const DECK_LIST_MIN_WIDTH = 480;
export const COLLAPSED_PANE_WIDTH = 44;
export const PANE_KEY_STEP = 16;
export const PANE_KEY_STEP_LARGE = 64;

export const DEFAULT_DECK_EDITOR_LAYOUT: DeckEditorLayoutPrefs = {
  dockWidth: null,
  inspectorWidth: null,
  dockCollapsed: false,
  inspectorCollapsed: false,
  density: 'comfortable',
  collapsedGroups: [],
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function defaultPaneWidth(pane: DeckPane, containerWidth: number): number {
  return pane === 'dock' ? 300 : clamp(Math.round(containerWidth * 0.28), 320, 420);
}

function storedWidth(value: unknown, pane: DeckPane): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(Math.round(value), PANE_LIMITS[pane].min, PANE_LIMITS[pane].max)
    : null;
}

export function parseLayoutPrefs(raw: string | null): DeckEditorLayoutPrefs {
  if (!raw) {
    return DEFAULT_DECK_EDITOR_LAYOUT;
  }
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_DECK_EDITOR_LAYOUT;
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_DECK_EDITOR_LAYOUT;
  }
  return {
    dockWidth: storedWidth(data.dockWidth, 'dock'),
    inspectorWidth: storedWidth(data.inspectorWidth, 'inspector'),
    dockCollapsed: data.dockCollapsed === true,
    inspectorCollapsed: data.inspectorCollapsed === true,
    density: data.density === 'compact' ? 'compact' : 'comfortable',
    collapsedGroups: Array.isArray(data.collapsedGroups)
      ? [...new Set(data.collapsedGroups.filter((g): g is string => typeof g === 'string'))]
      : [],
  };
}

export function serializeLayoutPrefs(prefs: DeckEditorLayoutPrefs): string {
  return JSON.stringify(prefs);
}

function wantedWidth(prefs: DeckEditorLayoutPrefs, pane: DeckPane, containerWidth: number): number {
  const stored = pane === 'dock' ? prefs.dockWidth : prefs.inspectorWidth;
  return clamp(stored ?? defaultPaneWidth(pane, containerWidth), PANE_LIMITS[pane].min, PANE_LIMITS[pane].max);
}

function isCollapsed(prefs: DeckEditorLayoutPrefs, pane: DeckPane): boolean {
  return pane === 'dock' ? prefs.dockCollapsed : prefs.inspectorCollapsed;
}

export function resolveDeckEditorLayout(prefs: DeckEditorLayoutPrefs, containerWidth: number): ResolvedDeckEditorLayout {
  const room = Math.max(0, containerWidth - DECK_LIST_MIN_WIDTH);
  const dockWant = prefs.dockCollapsed ? COLLAPSED_PANE_WIDTH : wantedWidth(prefs, 'dock', containerWidth);
  const dockFloor = prefs.dockCollapsed ? COLLAPSED_PANE_WIDTH : PANE_LIMITS.dock.min;
  const inspectorFloor = prefs.inspectorCollapsed ? COLLAPSED_PANE_WIDTH : PANE_LIMITS.inspector.min;
  const inspectorDocked = room >= dockFloor + inspectorFloor;

  if (!inspectorDocked) {
    const dockWidth = Math.max(dockFloor, Math.min(dockWant, room));
    return {
      dockWidth,
      inspectorWidth: Math.min(wantedWidth(prefs, 'inspector', containerWidth), Math.max(0, containerWidth - dockWidth)),
      inspectorDocked,
      dockRange: { min: PANE_LIMITS.dock.min, max: Math.max(PANE_LIMITS.dock.min, Math.min(PANE_LIMITS.dock.max, room)) },
      inspectorRange: { ...PANE_LIMITS.inspector },
    };
  }

  const dockWidth = Math.max(dockFloor, Math.min(dockWant, room - inspectorFloor));
  const inspectorWidth = prefs.inspectorCollapsed
    ? COLLAPSED_PANE_WIDTH
    : Math.max(inspectorFloor, Math.min(wantedWidth(prefs, 'inspector', containerWidth), room - dockWidth));
  const rangeFor = (pane: DeckPane, other: number): PaneRange => ({
    min: PANE_LIMITS[pane].min,
    max: Math.max(PANE_LIMITS[pane].min, Math.min(PANE_LIMITS[pane].max, room - other)),
  });
  return {
    dockWidth,
    inspectorWidth,
    inspectorDocked,
    dockRange: rangeFor('dock', inspectorWidth),
    inspectorRange: rangeFor('inspector', dockWidth),
  };
}

export function paneWidth(layout: ResolvedDeckEditorLayout, pane: DeckPane): number {
  return pane === 'dock' ? layout.dockWidth : layout.inspectorWidth;
}

export function paneRange(layout: ResolvedDeckEditorLayout, pane: DeckPane): PaneRange {
  return pane === 'dock' ? layout.dockRange : layout.inspectorRange;
}

export function clampPaneWidth(width: number, range: PaneRange): number {
  return clamp(Math.round(width), range.min, range.max);
}

export function withPaneWidth(prefs: DeckEditorLayoutPrefs, pane: DeckPane, width: number | null): DeckEditorLayoutPrefs {
  return pane === 'dock' ? { ...prefs, dockWidth: width } : { ...prefs, inspectorWidth: width };
}

export function withPaneCollapsed(prefs: DeckEditorLayoutPrefs, pane: DeckPane, collapsed: boolean): DeckEditorLayoutPrefs {
  if (isCollapsed(prefs, pane) === collapsed) {
    return prefs;
  }
  return pane === 'dock' ? { ...prefs, dockCollapsed: collapsed } : { ...prefs, inspectorCollapsed: collapsed };
}

export function withGroupsCollapsed(
  prefs: DeckEditorLayoutPrefs,
  groups: readonly string[],
  collapsed: boolean,
): DeckEditorLayoutPrefs {
  const next = new Set(prefs.collapsedGroups);
  for (const group of groups) {
    if (collapsed) {
      next.add(group);
    } else {
      next.delete(group);
    }
  }
  return { ...prefs, collapsedGroups: [...next] };
}
