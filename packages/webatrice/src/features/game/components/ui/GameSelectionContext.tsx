import { createContext, useContext, useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export interface GameSelectionState {
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
}

export const EMPTY_CARD_KEYS: ReadonlySet<string> = new Set();

const GameSelectionContext = createContext<GameSelectionState | null>(null);

export function GameSelectionProvider({
  selectedCardKeys,
  setSelectedCardKeys,
  children,
}: GameSelectionState & { children: ReactNode }) {
  const value = useMemo(
    () => ({ selectedCardKeys, setSelectedCardKeys }),
    [selectedCardKeys, setSelectedCardKeys],
  );
  return <GameSelectionContext.Provider value={value}>{children}</GameSelectionContext.Provider>;
}

export function useGameSelectionState(): GameSelectionState | null {
  return useContext(GameSelectionContext);
}
