import { useGameId } from '../components/ui/GameIdContext';
import { useCurrentGame } from './useCurrentGame';

// The local user's role/identity for the active game, narrowed from
// useCurrentGame and sourced off GameIdContext so callers neither thread gameId
// nor re-derive these flags from raw `game` fields. Single read site for the
// "who am I in this game" question (was previously inline selectors / a drilled
// `localPlayerId` prop).
export interface LocalIdentity {
  localPlayerId: number | undefined;
  isHost: boolean;
  isJudge: boolean;
  isSpectator: boolean;
}

export function useLocalIdentity(): LocalIdentity {
  const gameId = useGameId();
  const { game, isHost, isJudge, isSpectator } = useCurrentGame(gameId);
  return {
    localPlayerId: game?.localPlayerId,
    isHost,
    isJudge,
    isSpectator,
  };
}
