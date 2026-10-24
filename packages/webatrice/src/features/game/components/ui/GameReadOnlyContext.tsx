import { createContext, useContext } from 'react';

const GameReadOnlyContext = createContext(false);

export const GameReadOnlyProvider = GameReadOnlyContext.Provider;

export function useGameReadOnly(): boolean {
  return useContext(GameReadOnlyContext);
}
