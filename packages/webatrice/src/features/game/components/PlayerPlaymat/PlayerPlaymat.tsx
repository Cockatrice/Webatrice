import { ServerCapability, games, server } from '@cockatrice/datatrice';
import { PlaymatVisibility, usePlaymatSettings } from '@app/hooks';
import { useAppSelector } from '@app/store';

import { useGameId } from '../ui/GameIdContext';
import PlaymatArt from './PlaymatArt';

interface PlayerPlaymatProps {
  playerId: number;
  isSelf: boolean;
}

export default function PlayerPlaymat({ playerId, isSelf }: PlayerPlaymatProps) {
  const playmat = usePlayerPlaymat(playerId, isSelf);
  return playmat && <PlaymatArt art={playmat} testId="player-playmat" />;
}

export function usePlayerPlaymat(playerId: number | undefined, isSelf: boolean) {
  const gameId = useGameId();
  const supported = useAppSelector((state) => server.Selectors.supports(state, ServerCapability.PLAYMATS));
  const playmat = useAppSelector((state) =>
    gameId == null || playerId == null ? null : games.Selectors.getPlayerPlaymat(state, gameId, playerId));
  const { visibility } = usePlaymatSettings();
  const visible = supported && playmat !== null
    && visibility !== PlaymatVisibility.NONE
    && (isSelf || visibility === PlaymatVisibility.ALL);
  return visible ? playmat : null;
}
