import { useCallback, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import { Filter, FilterX, Plus, LogIn, Eye, Gavel, ArrowUp, ArrowDown } from 'lucide-react';

import { server, rooms, games, type GameFilters, type Room, type Game } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { VirtualRows } from '@app/components';
import { useReduxEffect } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { CreateGameParams, Event_GameJoined, JoinGameParams, ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';
import { AlertDialog, PromptDialog } from '@app/dialogs';

import CreateGameDialog from '../dialogs/CreateGameDialog/CreateGameDialog';
import FilterGamesDialog from '../dialogs/FilterGamesDialog/FilterGamesDialog';
import { useOpenGames } from './useOpenGames';

interface GamesListProps {
  room: Room;
}

interface PendingPasswordJoin {
  gameId: number;
  asSpectator: boolean;
  asJudge: boolean;
}

// Column definitions kept next to the grid so header labels + sort
// fields stay in sync with what the row cells render. Column widths live in
// GRID_COLS (shared by header and rows) — the body is virtualized with
// react-window, so table layout is replaced by a fixed grid template.
const COLUMNS: Array<{ label: string; field?: string }> = [
  { label: 'Age', field: 'info.startTime' },
  { label: 'Description', field: 'info.description' },
  { label: 'Creator', field: 'info.creatorInfo.name' },
  { label: 'Type', field: 'gameType' },
  { label: 'Restrictions' },
  { label: 'Players' },
  { label: 'Spectators', field: 'info.spectatorsCount' },
];

const GRID_COLS = 'grid grid-cols-[6rem_minmax(0,1fr)_10rem_8rem_14rem_5rem_8rem]';
// px-3 py-2 text-sm cells: 16px padding + 20px line box + 1px bottom border.
const GAME_ROW_HEIGHT = 37;

function formatRestrictions(info: ServerInfo_Game): string {
  const parts: string[] = [];
  if (info.withPassword) {
    parts.push('password');
  }
  if (info.onlyBuddies) {
    parts.push('buddies only');
  }
  if (info.onlyRegistered) {
    parts.push('reg. users only');
  }
  if (info.shareDecklistsOnLoad) {
    parts.push('open decklists');
  }
  return parts.join(', ');
}

function formatSpectators(info: ServerInfo_Game): string {
  if (!info.spectatorsAllowed) {
    return 'not allowed';
  }
  const flags: string[] = [];
  if (info.spectatorsCanChat) {
    flags.push('can chat');
  }
  if (info.spectatorsOmniscient) {
    flags.push('see hands');
  }
  if (flags.length === 0) {
    return String(info.spectatorsCount);
  }
  return `${info.spectatorsCount} (${flags.join(' & ')})`;
}

/**
 * Fancy-themed replacement for `<GameSelector>`. Keeps all og redux
 * hooks + dialogs (create/filter/password/error) so backend behavior
 * is identical; only the presentation changes.
 */
export default function GamesList({ room }: GamesListProps) {
  const roomId = room.info.roomId;
  const webClient = useWebClient();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { sortBy, games: gameList, selectedGameId, handleSort, handleSelect, handleActivate } =
    useOpenGames({ roomId, onActivateGame: (_id) => beginJoin(false, false) });

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

  function beginJoin(asSpectator: boolean, asJudge: boolean) {
    const game = selectedGame;
    if (!game) {
      return;
    }
    const info = game.info;
    const effectiveSpectator = asSpectator || info.playerCount >= info.maxPlayers;
    const needsPassword =
      info.withPassword && !(effectiveSpectator && !info.spectatorsNeedPassword);
    if (needsPassword) {
      setPendingPasswordJoin({ gameId: info.gameId, asSpectator: effectiveSpectator, asJudge });
      return;
    }
    sendJoin(info.gameId, effectiveSpectator, asJudge, '');
  }

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

  const sortOrder = sortBy.order.toLowerCase() === 'asc' ? 'asc' : 'desc';

  // Stable renderRow identity (deps are only what changes a row's drawing:
  // selection + the row handlers) so react-window's row memoization holds — see
  // webatrice.instructions.md § Virtualized lists.
  const renderGameRow = useCallback((game: Game) => {
    const { info, gameType } = game;
    const isSelected = info.gameId === selectedGameId;
    return (
      <div
        onClick={() => handleSelect(info.gameId)}
        onDoubleClick={() => handleActivate(info.gameId)}
        className={[
          GRID_COLS,
          'cursor-pointer transition-colors',
          isSelected
            ? 'bg-accent/20 hover:bg-accent/25'
            : 'hover:bg-bg-elevated',
        ].join(' ')}
      >
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-secondary tabular-nums whitespace-nowrap">
          {info.startTime}
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-primary overflow-hidden">
          <div className="truncate" title={info.description}>{info.description}</div>
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-secondary overflow-hidden">
          <div className="truncate">{info.creatorInfo?.name ?? ''}</div>
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-secondary whitespace-nowrap">
          {gameType}
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-secondary overflow-hidden">
          <div className="truncate">{formatRestrictions(info)}</div>
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-primary tabular-nums whitespace-nowrap">
          {info.playerCount}/{info.maxPlayers}
        </div>
        <div className="px-3 py-2 border-b border-border-subtle/50 text-text-secondary overflow-hidden">
          <div className="truncate">{formatSpectators(info)}</div>
        </div>
      </div>
    );
  }, [selectedGameId, handleSelect, handleActivate]);

  return (
    <section className="flex h-full flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div>
          <h2 className="font-modern text-lg font-semibold text-text-primary">Games in {room.info.name}</h2>
          <p className="text-xs text-text-muted mt-0.5 tabular-nums">
            Showing {counts.visible} / {counts.total}
          </p>
        </div>
      </div>

      {/* Games grid — header fixed above a virtualized row window so a busy
          server's thousands of games cost O(viewport) per delta frame. The
          header and the row scroller both reserve a stable scrollbar gutter so
          their shared GRID_COLS tracks stay aligned once the body overflows
          (the row pane's scrollbar would otherwise narrow the rows vs the
          header). The gutter's track is transparent (thin-scrollbar.css), so
          the header's reserved-but-unused gutter is invisible. */}
      <div className={`${GRID_COLS} shrink-0 bg-bg-elevated text-sm overflow-auto [scrollbar-gutter:stable]`}>
        {COLUMNS.map(({ label, field }) => {
          const active = field === sortBy.field;
          return (
            <div
              key={label}
              className={[
                'text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-subtle select-none',
                field ? 'cursor-pointer hover:text-text-primary' : '',
              ].join(' ')}
              onClick={() => field && handleSort(field)}
            >
              <span className="inline-flex items-center gap-1">
                {label}
                {active && (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 text-sm">
        {gameList.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            No games open right now — click <span className="text-text-primary">Create</span> to start one.
          </div>
        ) : (
          <VirtualRows
            items={gameList}
            rowHeight={GAME_ROW_HEIGHT}
            className="[scrollbar-gutter:stable]"
            renderRow={renderGameRow}
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border-subtle bg-bg-surface">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            isFilterActive
              ? 'bg-accent text-white hover:bg-accent-hover'
              : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle',
          ].join(' ')}
        >
          <Filter size={14} /> Filter games
        </button>
        <button
          type="button"
          onClick={() => dispatch(rooms.Actions.clearGameFilters({ roomId }))}
          disabled={!isFilterActive}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FilterX size={14} /> Clear filter
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
        >
          <Plus size={14} /> Create
        </button>
        <button
          type="button"
          onClick={() => beginJoin(false, false)}
          disabled={!canJoin}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <LogIn size={14} /> Join
        </button>
        <button
          type="button"
          onClick={() => beginJoin(true, false)}
          disabled={!canSpectate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Eye size={14} /> Spectate
        </button>
        {isJudgeUser && (
          <>
            <button
              type="button"
              onClick={() => beginJoin(false, true)}
              disabled={!canJoin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Gavel size={14} /> Judge
            </button>
            <button
              type="button"
              onClick={() => beginJoin(true, true)}
              disabled={!canSpectate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Gavel size={14} /> Judge · Spectate
            </button>
          </>
        )}
      </div>

      {/* Dialogs — kept as-is; a later piece will reskin these too */}
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
    </section>
  );
}
