import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { games, rooms, type Game, type GametypeMap } from '@cockatrice/datatrice';
import { GameCard } from '@app/components';
import { AlertDialog, ConfirmDialog, PromptDialog } from '@app/dialogs';
import { useCanOverrideGameRestrictions, useJoinGame, useJoinGameErrorMessage, useNavigateOnGameJoined } from '@app/hooks';
import { useAppSelector } from '@app/store';

import type { HomeData } from '../useHome';
import BuddyGames from './BuddyGames';
import type { RenderGameCard } from './GameGrid';
import OpenGames from './OpenGames';

interface HomeGameCardProps {
  roomId: number;
  gameId: number;
  gametypeMap: GametypeMap;
  overrideRestrictions: boolean;
  busy: boolean;
  onJoin: (roomId: number, game: Game) => void;
  onSpectate: (roomId: number, game: Game) => void;
}

const HomeGameCard = memo(function HomeGameCard({
  roomId,
  gameId,
  gametypeMap,
  overrideRestrictions,
  busy,
  onJoin,
  onSpectate,
}: HomeGameCardProps) {
  const game = useAppSelector((state) => rooms.Selectors.getRoomGames(state, roomId)[gameId]);
  const alreadyJoined = useAppSelector((state) => games.Selectors.getActiveGameIds(state).includes(gameId));
  const joinGame = useCallback((selected: Game) => onJoin(roomId, selected), [onJoin, roomId]);
  const spectateGame = useCallback((selected: Game) => onSpectate(roomId, selected), [onSpectate, roomId]);

  if (!game) {
    return null;
  }

  return (
    <GameCard
      game={game}
      gametypeMap={gametypeMap}
      overrideRestrictions={overrideRestrictions}
      alreadyJoined={alreadyJoined}
      busy={busy}
      onJoin={joinGame}
      onSpectate={spectateGame}
    />
  );
});

export default function HomeGames({ home }: { home: HomeData }) {
  const { t } = useTranslation();
  const overrideRestrictions = useCanOverrideGameRestrictions();
  const join = useJoinGame();
  const { beginJoin } = join;
  const joinErrorMessage = useJoinGameErrorMessage(join.joinError);
  useNavigateOnGameJoined();

  const handleJoin = useCallback(
    (roomId: number, game: Game) => beginJoin(roomId, game.info, false, false),
    [beginJoin],
  );
  const handleSpectate = useCallback(
    (roomId: number, game: Game) => beginJoin(roomId, game.info, true, false),
    [beginJoin],
  );
  const renderCard: RenderGameCard = useCallback((room, game) => (
    <HomeGameCard
      roomId={room.info.roomId}
      gameId={game.info.gameId}
      gametypeMap={room.gametypeMap}
      overrideRestrictions={overrideRestrictions}
      busy={join.joinPending}
      onJoin={handleJoin}
      onSpectate={handleSpectate}
    />
  ), [handleJoin, handleSpectate, join.joinPending, overrideRestrictions]);

  const buddies = <BuddyGames key="buddies" home={home} renderCard={renderCard} />;
  const open = <OpenGames key="open" home={home} renderCard={renderCard} />;

  return (
    <>
      {home.buddyGames.length > 0 ? [buddies, open] : [open, buddies]}
      <ConfirmDialog
        cancelDefault
        title={t('GameLink.confirm.title')}
        message={t('GameLink.full')}
        confirmLabel={t('GameLink.yes')}
        cancelLabel={t('GameLink.no')}
        isOpen={join.spectatorConfirmationRequired}
        onConfirm={join.confirmSpectatorJoin}
        onCancel={join.cancelSpectatorJoin}
      />
      <PromptDialog
        isOpen={join.passwordRequired}
        title={t('HomeGames.passwordTitle')}
        label={t('Common.label.password')}
        type="password"
        submitLabel={t('Common.action.join')}
        onSubmit={join.submitPassword}
        onCancel={join.cancelPassword}
      />
      <AlertDialog
        isOpen={join.joinError !== null}
        title={t('HomeGames.errorTitle')}
        message={joinErrorMessage}
        onDismiss={join.clearJoinError}
      />
    </>
  );
}
