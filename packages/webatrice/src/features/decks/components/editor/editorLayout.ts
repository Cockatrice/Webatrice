import type { CSSProperties } from 'react';

export const DECK_DOCK_WIDTH_VAR = '--deck-dock-w';
export const DECK_INSPECTOR_WIDTH_VAR = '--deck-inspector-w';
export const DECK_DOCK_DEFAULT_WIDTH = '300px';
export const DECK_INSPECTOR_DEFAULT_WIDTH = 'clamp(320px, 26vw, 420px)';

export interface DeckEditorGridWidths {
  dock?: number;
  inspector?: number;
  inspectorColumn: boolean;
}

const px = (value: number | undefined, fallback: string) => (value == null ? fallback : `${value}px`);

export function deckEditorGridStyle({ dock, inspector, inspectorColumn }: DeckEditorGridWidths): CSSProperties {
  return {
    [DECK_DOCK_WIDTH_VAR]: px(dock, DECK_DOCK_DEFAULT_WIDTH),
    [DECK_INSPECTOR_WIDTH_VAR]: px(inspector, DECK_INSPECTOR_DEFAULT_WIDTH),
    gridTemplateColumns: inspectorColumn
      ? `var(${DECK_DOCK_WIDTH_VAR}) minmax(0,1fr) var(${DECK_INSPECTOR_WIDTH_VAR})`
      : `var(${DECK_DOCK_WIDTH_VAR}) minmax(0,1fr)`,
  } as CSSProperties;
}
