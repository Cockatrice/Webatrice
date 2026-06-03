import { createContext, useContext } from 'react';

// The active game's id, resolved once at the top of the feature (Game, from the
// route via useCurrentGame) and shared through context instead of threaded as a
// prop into every board/sidebar component. May be undefined pre-game / outside a
// provider, mirroring the optional gameId the components previously accepted.
const GameIdContext = createContext<number | undefined>(undefined);

export const GameIdProvider = GameIdContext.Provider;

// For sidebar/top-level components that can render before a game resolves.
export function useGameId(): number | undefined {
  return useContext(GameIdContext);
}

// For board components that only mount inside an active game (Game gates the
// board on `game && ...`), so they can rely on a defined id like the required
// `gameId` prop they used to take.
export function useGameIdRequired(): number {
  const gameId = useContext(GameIdContext);
  if (gameId == null) {
    throw new Error('useGameIdRequired must be used inside an active game (GameIdProvider with a gameId)');
  }
  return gameId;
}
