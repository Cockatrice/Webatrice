import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { games, rooms, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { Response_ResponseCode, type ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { AlertDialog, DialogShell, ConfirmDialog, PromptDialog } from '@app/dialogs';
import {
  useCanOverrideGameRestrictions, useCommandFailureMessage, useGridRows, useJoinGame, useJoinGameErrorMessage, useNavigateOnGameJoined,
} from '@app/hooks';
import { useAppSelector } from '@app/store';
import { formatRestrictions, formatSpectators } from '@app/utils';

const CELL_CLASS = 'px-3 py-2 border-b border-border-subtle/50 whitespace-nowrap';
const HEADER_CELL_CLASS =
  'text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-subtle';
const BUTTON_CLASS =
  'px-3 py-1.5 rounded-md text-sm font-medium bg-bg-elevated text-text-secondary hover:text-text-primary '
  + 'border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const COLUMNS = ['room', 'description', 'creator', 'type', 'restrictions', 'players', 'spectators'] as const;

const FAILURE_KEYS: Partial<Record<Response_ResponseCode, string>> = {
  [Response_ResponseCode.RespNameNotFound]: 'UserGamesDialog.error.userNotFound',
  [Response_ResponseCode.RespInIgnoreList]: 'UserGamesDialog.error.ignored',
};

interface UserGamesDialogProps {
  userName: string;
  onClose: () => void;
}

export default function UserGamesDialog({ userName, onClose }: UserGamesDialogProps) {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const webClient = useWebClient();
  const overrideRestrictions = useCanOverrideGameRestrictions();
  const status = useAppSelector((state) => server.Selectors.getGamesOfUserStatus(state, userName));
  const gameList = useAppSelector((state) => server.Selectors.getGamesOfUser(state, userName));
  const roomNames = useAppSelector((state) => server.Selectors.getGamesOfUserRoomNames(state, userName));
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);
  const joinedRoomIds = useAppSelector(rooms.Selectors.getJoinedRoomIds);
  const isJudgeUser = useAppSelector(server.Selectors.getIsUserJudge);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [roomNotJoined, setRoomNotJoined] = useState(false);
  const { beginJoin, passwordRequired, passwordGame, submitPassword, cancelPassword, joinPending, joinError, clearJoinError,
    spectatorConfirmationRequired, confirmSpectatorJoin, cancelSpectatorJoin } =
    useJoinGame(onClose);
  const joinErrorMessage = useJoinGameErrorMessage(joinError);

  useEffect(() => {
    webClient.request.session.getGamesOfUser(userName);
  }, [userName, webClient]);

  const closeOnJoin = useCallback(
    (gameId: number) => {
      if (gameList.some((game) => game.info.gameId === gameId)) {
        onClose();
      }
    },
    [gameList, onClose],
  );
  useNavigateOnGameJoined(closeOnJoin);

  const selected = gameList.find((game) => game.info.gameId === selectedGameId)?.info;

  const join = useCallback(
    (game: ServerInfo_Game | undefined, asSpectator: boolean, asJudge: boolean) => {
      if (!game) {
        return;
      }
      if (!activeGameIds.includes(game.gameId) && !joinedRoomIds[game.roomId]) {
        setRoomNotJoined(true);
        return;
      }
      beginJoin(game.roomId, game, asSpectator, asJudge);
    },
    [activeGameIds, beginJoin, joinedRoomIds],
  );

  const { getRowProps } = useGridRows({
    keys: gameList.map(({ info }) => String(info.gameId)),
    selectedKey: selectedGameId == null ? null : String(selectedGameId),
    onSelect: (key) => setSelectedGameId(Number(key)),
    onActivate: (key) => {
      const info = gameList.find((game) => String(game.info.gameId) === key)?.info;
      if (info) {
        setSelectedGameId(info.gameId);
        join(info, false, false);
      }
    },
  });

  const canJoin = Boolean(selected && (selected.playerCount < selected.maxPlayers || overrideRestrictions)) && !joinPending;
  const canSpectate = Boolean(selected && (selected.spectatorsAllowed || overrideRestrictions)) && !joinPending;

  let body;
  let failure: string | null = null;
  if (status?.state === 'failed') {
    const key = FAILURE_KEYS[status.responseCode as Response_ResponseCode] ?? 'UserGamesDialog.error.unknown';
    failure = describeFailure(status.failure, t(key, { name: userName }));
  } else if (status?.state !== 'loaded') {
    body = <p className="text-sm text-text-muted">{t('UserGamesDialog.loading')}</p>;
  } else if (gameList.length === 0) {
    body = <p className="text-sm text-text-muted">{t('UserGamesDialog.empty', { name: userName })}</p>;
  } else {
    body = (
      <table
        role="grid"
        aria-label={t('UserGamesDialog.title', { name: userName })}
        className="w-full text-sm text-text-secondary border-separate"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} role="columnheader" className={HEADER_CELL_CLASS}>{t(`UserGamesDialog.column.${column}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gameList.map(({ info, gameType }) => (
            <tr
              key={info.gameId}
              {...getRowProps(String(info.gameId))}
              role="row"
              aria-selected={info.gameId === selectedGameId}
              onClick={() => setSelectedGameId(info.gameId)}
              onDoubleClick={() => join(info, false, false)}
              className={[
                'cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 '
                  + 'focus-visible:-outline-offset-2 focus-visible:outline-accent',
                info.gameId === selectedGameId ? 'bg-accent/20' : 'hover:bg-bg-elevated',
              ].join(' ')}
            >
              <td role="gridcell" className={CELL_CLASS}>{roomNames[info.roomId] ?? `#${info.roomId}`}</td>
              <td role="gridcell" className={`${CELL_CLASS} text-text-primary`}>{info.description}</td>
              <td role="gridcell" className={CELL_CLASS}>{info.creatorInfo?.name ?? ''}</td>
              <td role="gridcell" className={CELL_CLASS}>{gameType}</td>
              <td role="gridcell" className={CELL_CLASS}>{formatRestrictions(t, info)}</td>
              <td role="gridcell" className={`${CELL_CLASS} tabular-nums`}>{info.playerCount}/{info.maxPlayers}</td>
              <td role="gridcell" className={CELL_CLASS}>{formatSpectators(t, info)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <DialogShell
        isOpen={!spectatorConfirmationRequired}
        title={t('UserGamesDialog.title', { name: userName })}
        handleClose={onClose}
        maxWidth="max-w-4xl"
      >
        <div className="min-h-24 overflow-x-auto">
          <p role="alert" className={failure ? 'text-sm text-text-secondary' : 'sr-only'}>{failure}</p>
          {body}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={BUTTON_CLASS} disabled={!canJoin} onClick={() => join(selected, false, false)}>
            {t('UserGamesDialog.action.join')}
          </button>
          {isJudgeUser && (
            <button type="button" className={BUTTON_CLASS} disabled={!canJoin} onClick={() => join(selected, false, true)}>
              {t('UserGamesDialog.action.joinAsJudge')}
            </button>
          )}
          <button type="button" className={BUTTON_CLASS} disabled={!canSpectate} onClick={() => join(selected, true, false)}>
            {t('UserGamesDialog.action.spectate')}
          </button>
          {isJudgeUser && (
            <button type="button" className={BUTTON_CLASS} disabled={!canSpectate} onClick={() => join(selected, true, true)}>
              {t('UserGamesDialog.action.spectateAsJudge')}
            </button>
          )}
        </div>
      </DialogShell>
      <ConfirmDialog
        cancelDefault
        title={t('GameLink.confirm.title')}
        message={t('GameLink.full')}
        confirmLabel={t('GameLink.yes')}
        cancelLabel={t('GameLink.no')}
        isOpen={spectatorConfirmationRequired}
        onConfirm={confirmSpectatorJoin}
        onCancel={cancelSpectatorJoin}
      />
      <PromptDialog
        isOpen={passwordRequired}
        title={t('UserGamesDialog.password.title')}
        type="password"
        label={passwordGame?.description
          ? t('UserGamesDialog.password.label', { name: passwordGame.description })
          : t('UserGamesDialog.password.gameIdLabel', { gameId: passwordGame?.gameId })}
        submitLabel={t('UserGamesDialog.password.submit')}
        onSubmit={submitPassword}
        onCancel={cancelPassword}
      />
      <AlertDialog
        isOpen={joinError !== null || roomNotJoined}
        title={t('UserGamesDialog.error.title')}
        message={roomNotJoined ? t('UserGamesDialog.error.joinRoomFirst') : joinErrorMessage}
        onDismiss={() => (roomNotJoined ? setRoomNotJoined(false) : clearJoinError())}
      />
    </>
  );
}
