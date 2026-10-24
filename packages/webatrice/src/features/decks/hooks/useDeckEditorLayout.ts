import { useCallback, useEffect, useMemo, useState } from 'react';

import { readLocalStorage, writeLocalStorage } from '@app/services';

import {
  clampPaneWidth,
  DECK_LAYOUT_STORAGE_KEY,
  DEFAULT_DECK_EDITOR_LAYOUT,
  paneRange,
  paneWidth,
  parseLayoutPrefs,
  resolveDeckEditorLayout,
  serializeLayoutPrefs,
  withGroupsCollapsed,
  withPaneCollapsed,
  withPaneWidth,
  type DeckEditorLayoutPrefs,
  type DeckPane,
  type DeckRowDensity,
} from '../deckEditorLayout';
import { useElementWidth } from './useElementWidth';

export function readDeckEditorLayout(): DeckEditorLayoutPrefs {
  return parseLayoutPrefs(readLocalStorage(DECK_LAYOUT_STORAGE_KEY));
}

export function useDeckEditorLayout() {
  const [prefs, setPrefs] = useState<DeckEditorLayoutPrefs>(readDeckEditorLayout);
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    writeLocalStorage(DECK_LAYOUT_STORAGE_KEY, serializeLayoutPrefs(prefs));
  }, [prefs]);

  const layout = useMemo(() => resolveDeckEditorLayout(prefs, containerWidth), [prefs, containerWidth]);

  const setPaneWidth = useCallback((pane: DeckPane, width: number) => {
    setPrefs((current) => {
      const range = paneRange(resolveDeckEditorLayout(current, containerWidth), pane);
      return withPaneWidth(current, pane, clampPaneWidth(width, range));
    });
  }, [containerWidth]);

  const resizePaneBy = useCallback((pane: DeckPane, delta: number) => {
    setPrefs((current) => {
      const resolved = resolveDeckEditorLayout(current, containerWidth);
      return withPaneWidth(current, pane, clampPaneWidth(paneWidth(resolved, pane) + delta, paneRange(resolved, pane)));
    });
  }, [containerWidth]);

  const resetPaneWidth = useCallback((pane: DeckPane) => {
    setPrefs((current) => withPaneWidth(current, pane, null));
  }, []);

  const setPaneCollapsed = useCallback((pane: DeckPane, collapsed: boolean) => {
    setPrefs((current) => withPaneCollapsed(current, pane, collapsed));
  }, []);

  const setDensity = useCallback((density: DeckRowDensity) => {
    setPrefs((current) => (current.density === density ? current : { ...current, density }));
  }, []);

  const setGroupsCollapsed = useCallback((groups: readonly string[], collapsed: boolean) => {
    setPrefs((current) => withGroupsCollapsed(current, groups, collapsed));
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULT_DECK_EDITOR_LAYOUT), []);

  const collapsedGroups = useMemo(() => new Set(prefs.collapsedGroups), [prefs.collapsedGroups]);
  const inspectorDocksWhenExpanded = useMemo(
    () => resolveDeckEditorLayout(withPaneCollapsed(prefs, 'inspector', false), containerWidth).inspectorDocked,
    [prefs, containerWidth],
  );

  return {
    containerRef,
    containerWidth,
    layout,
    prefs,
    collapsedGroups,
    inspectorDocksWhenExpanded,
    isPaneCollapsed: (pane: DeckPane) => (pane === 'dock' ? prefs.dockCollapsed : prefs.inspectorCollapsed),
    setPaneWidth,
    resizePaneBy,
    resetPaneWidth,
    setPaneCollapsed,
    setDensity,
    setGroupsCollapsed,
    reset,
  };
}

export type DeckEditorLayoutApi = ReturnType<typeof useDeckEditorLayout>;
