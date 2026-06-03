import { createContext, useContext, useMemo, ReactNode } from 'react';

// Per-card visual state shared across the board without prop-drilling. These are
// the values every card renderer compares its own makeCardKey() against to derive
// isArrowSource / isArrowTarget / isSelected. Sourced once in Game from the arrow
// and selection sub-systems; consumed at the per-card loopers (StackColumn,
// HandZone, AttachmentStack) and PlayerInfoPanel.
export interface CardVisualState {
  arrowSourceKey: string | null;
  arrowTargetKey: string | null;
  selectedCardKeys: ReadonlySet<string>;
}

// Whether the local user may act on a given seat's cards (own seat, or judge).
// Built from the board layout's per-cell canAct.
export type CanActFor = (playerId: number) => boolean;

const CardVisualStateContext = createContext<CardVisualState | null>(null);
const CardActabilityContext = createContext<CanActFor | null>(null);

export interface CardVisualStateProviderProps extends CardVisualState {
  canActFor: CanActFor;
  children: ReactNode;
}

/**
 * Splits two concerns into two contexts on purpose: arrow/selection change
 * frequently (arrowTargetKey ticks on every mousemove during an arrow drag),
 * while actability only changes when the board layout does. Keeping them apart
 * means canActFor-only consumers (e.g. Battlefield) don't re-render on every
 * arrow tick — only the per-card loopers that actually paint highlights do.
 */
export function CardVisualStateProvider({
  arrowSourceKey,
  arrowTargetKey,
  selectedCardKeys,
  canActFor,
  children,
}: CardVisualStateProviderProps) {
  const visual = useMemo<CardVisualState>(
    () => ({ arrowSourceKey, arrowTargetKey, selectedCardKeys }),
    [arrowSourceKey, arrowTargetKey, selectedCardKeys],
  );
  return (
    <CardActabilityContext.Provider value={canActFor}>
      <CardVisualStateContext.Provider value={visual}>
        {children}
      </CardVisualStateContext.Provider>
    </CardActabilityContext.Provider>
  );
}

export function useCardVisualState(): CardVisualState {
  const ctx = useContext(CardVisualStateContext);
  if (!ctx) {
    throw new Error('useCardVisualState must be used inside <CardVisualStateProvider>');
  }
  return ctx;
}

export function useCanActFor(): CanActFor {
  const ctx = useContext(CardActabilityContext);
  if (!ctx) {
    throw new Error('useCanActFor must be used inside <CardVisualStateProvider>');
  }
  return ctx;
}
