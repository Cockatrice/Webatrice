import { games, server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { useAppSelector, type RootState } from '@app/store';
import { useUnloadRisk } from './useUnloadRisk';

function hasGuestGameAtRisk(state: RootState): boolean {
  const user = server.Selectors.getUser(state);
  if (!user || (user.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) !== 0) {
    return false;
  }
  return Object.values(games.Selectors.getGames(state)).some(game =>
    game.started && !game.replay && !game.spectator && !game.players[game.localPlayerId]?.properties.conceded,
  );
}

export function useGuestGameUnloadRisk(): void {
  useUnloadRisk(useAppSelector(hasGuestGameAtRisk));
}
