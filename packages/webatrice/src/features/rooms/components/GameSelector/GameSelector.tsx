import { useCallback, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { server, rooms, games, type GameFilters } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { useReduxEffect } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';
import { CreateGameParams, Event_GameJoined, JoinGameParams } from '@cockatrice/sockatrice/generated';
import { Room } from '@cockatrice/datatrice';
import { RouteEnum } from '@app/types';
import { AlertDialog, PromptDialog } from '@app/dialogs';

import OpenGames from '../OpenGames';
import CreateGameDialog from '../../dialogs/CreateGameDialog/CreateGameDialog';
import FilterGamesDialog from '../../dialogs/FilterGamesDialog/FilterGamesDialog';
import GameSelectorToolbar from './GameSelectorToolbar';

import './GameSelector.css';

interface GameSelectorProps {
  room: Room;
}

interface PendingPasswordJoin {
  gameId: number;
  asSpectator: boolean;
  asJudge: boolean;
}

const GameSelector = ({ room }: GameSelectorProps) => {
  const roomId = room.info.roomId;
  const webClient = useWebClient();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const selectedGameId = useAppSelector((state) => rooms.Selectors.getSelectedGameId(state, roomId));
  const selectedGame = useAppSelector((state) =>
    selectedGameId != null ? rooms.Selectors.getRoomGames(state, roomId)[selectedGameId] : undefined,
  );
  const counts = useAppSelector((state) => rooms.Selectors.getRoomGameCounts(state, roomId));
  const isFilterActive = useAppSelector((state) => rooms.Selectors.isGameFilterActive(state, roomId));
  const filters = useAppSelector((state) => rooms.Selectors.getGameFilters(state, roomId));
  const isJudgeUser = useAppSelector(server.Selectors.getIsUserJudge);
  const joinPending = useAppSelector(rooms.Selectors.getJoinGamePending);
  const joinError = useAppSelector(rooms.Selectors.getJoinGameError);
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);

  // On Event_GameJoined: route to /game/:gameId.
  useReduxEffect<{ data: Event_GameJoined }>((action) => {
    const gameId = action.payload.data.gameInfo?.gameId;
    if (gameId == null) {
      return;
    }
    navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
  }, games.Types.GAME_JOINED, [navigate]);

  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingPasswordJoin, setPendingPasswordJoin] = useState<PendingPasswordJoin | null>(null);

  const sendJoin = useCallback(
    (gameId: number, asSpectator: boolean, asJudge: boolean, password: string) => {
      // Already in this game: skip the JoinGame (server would RespContextError) and route directly.
      if (activeGameIds.includes(gameId)) {
        navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
        return;
      }
      const params: JoinGameParams = {
        gameId,
        password,
        spectator: asSpectator,
        overrideRestrictions: false,
        joinAsJudge: asJudge,
      };
      webClient.request.rooms.joinGame(roomId, params);
    },
    [activeGameIds, navigate, roomId, webClient],
  );

  const beginJoin = useCallback(
    (asSpectator: boolean, asJudge: boolean) => {
      const game = selectedGame;
      if (!game) {
        return;
      }
      const info = game.info;
      const effectiveSpectator =
        asSpectator || info.playerCount >= info.maxPlayers;
      const needsPassword =
        info.withPassword && !(effectiveSpectator && !info.spectatorsNeedPassword);
      if (needsPassword) {
        setPendingPasswordJoin({ gameId: info.gameId, asSpectator: effectiveSpectator, asJudge });
        return;
      }
      sendJoin(info.gameId, effectiveSpectator, asJudge, '');
    },
    [selectedGame, sendJoin],
  );

  const handleActivate = useCallback(
    (_gameId: number) => {
      beginJoin(false, false);
    },
    [beginJoin],
  );

  const canJoin =
    Boolean(selectedGame && selectedGame.info.playerCount < selectedGame.info.maxPlayers) && !joinPending;
  const canSpectate = Boolean(selectedGame && selectedGame.info.spectatorsAllowed) && !joinPending;

  const handleCreateSubmit = (params: CreateGameParams) => {
    webClient.request.rooms.createGame(roomId, params);
    setCreateOpen(false);
  };

  const handleFilterSubmit = (next: GameFilters) => {
    dispatch(rooms.Actions.setGameFilters({ roomId, filters: next }));
    setFilterOpen(false);
  };

  const handlePasswordSubmit = (password: string) => {
    if (!pendingPasswordJoin) {
      return;
    }
    sendJoin(pendingPasswordJoin.gameId, pendingPasswordJoin.asSpectator, pendingPasswordJoin.asJudge, password);
    setPendingPasswordJoin(null);
  };

  return (
    <Paper className="game-selector overflow-scroll">
      <Typography className="game-selector__title" variant="subtitle2">
        Games shown: {counts.visible} / {counts.total}
      </Typography>
      <div className="game-selector__games">
        <OpenGames room={room} onActivateGame={handleActivate} />
      </div>
      <GameSelectorToolbar
        isFilterActive={isFilterActive}
        canCreate={true}
        canJoin={canJoin}
        canSpectate={canSpectate}
        isJudgeUser={isJudgeUser}
        onFilter={() => setFilterOpen(true)}
        onClearFilter={() => dispatch(rooms.Actions.clearGameFilters({ roomId }))}
        onCreate={() => setCreateOpen(true)}
        onJoin={() => beginJoin(false, false)}
        onSpectate={() => beginJoin(true, false)}
        onJoinAsJudge={() => beginJoin(false, true)}
        onSpectateAsJudge={() => beginJoin(true, true)}
      />

      <CreateGameDialog
        isOpen={createOpen}
        gametypeMap={room.gametypeMap}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
      <FilterGamesDialog
        isOpen={filterOpen}
        initialFilters={filters}
        gametypeMap={room.gametypeMap}
        onCancel={() => setFilterOpen(false)}
        onSubmit={handleFilterSubmit}
      />
      <PromptDialog
        isOpen={pendingPasswordJoin !== null}
        title="Password required"
        label="Password"
        submitLabel="Join"
        onSubmit={handlePasswordSubmit}
        onCancel={() => setPendingPasswordJoin(null)}
      />
      <AlertDialog
        isOpen={joinError !== null}
        title="Error"
        message={joinError?.message ?? ''}
        onDismiss={() => dispatch(rooms.Actions.clearJoinGameError())}
      />
    </Paper>
  );
};

export default GameSelector;
