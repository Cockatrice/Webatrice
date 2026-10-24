import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { games, rooms, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { AlertDialog, ConfirmDialog, PromptDialog } from '@app/dialogs';
import { useJoinGame, useJoinGameErrorMessage, useNavigateOnGameJoined } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { isSameGameServer, needsDesktopPort, parseGameJoinLink, type GameJoinLink, type LiveGameServer } from '@app/utils';

import { clearGameLinkRequest, useGameLinkRequest } from './gameLinkRequests';

export const GAME_LINK_WAIT_MS = 15_000;

type Flow =
  | { step: 'idle' }
  | { step: 'notice'; title: string; message: string }
  | { step: 'confirm'; link: GameJoinLink }
  | { step: 'awaitGame'; link: GameJoinLink }
  | { step: 'joining'; link: GameJoinLink; game: ServerInfo_Game };

const IDLE: Flow = { step: 'idle' };

function useGameLinkJoinHost(endpoint: LiveGameServer | null) {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const request = useGameLinkRequest();
  const [flow, setFlow] = useState<Flow>(IDLE);
  const {
    beginJoin,
    passwordRequired,
    submitPassword,
    cancelPassword,
    spectatorConfirmationRequired,
    confirmSpectatorJoin,
    cancelSpectatorJoin,
    joinError,
    clearJoinError,
  } = useJoinGame();

  const joinErrorMessage = useJoinGameErrorMessage(joinError);

  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const joinedRoomIds = useAppSelector(rooms.Selectors.getJoinedRoomIds);
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);
  const roomId = flow.step === 'idle' || flow.step === 'notice' ? undefined : flow.link.roomId;
  const room = useAppSelector((state) => (roomId != null ? rooms.Selectors.getRoom(state, roomId) : undefined));
  const awaitedGame = flow.step === 'awaitGame' ? room?.games[flow.link.gameId]?.info : undefined;

  const serverLabel = (link: GameJoinLink) => `${link.hostname}:${link.port}`;
  const close = useCallback(() => setFlow(IDLE), []);

  useEffect(() => {
    if (!request) {
      return;
    }
    clearGameLinkRequest();
    const parsed = parseGameJoinLink(request.url);
    if (parsed.ok === false) {
      setFlow({ step: 'notice', title: t('GameLink.invalid.title'), message: t(`GameLink.invalid.${parsed.error}`) });
      return;
    }
    setFlow({ step: 'confirm', link: parsed.link });
  }, [request, t]);

  const startJoin = useCallback(
    (link: GameJoinLink, game: ServerInfo_Game, spectator: boolean) => {
      setFlow(activeGameIds.includes(game.gameId) ? IDLE : { step: 'joining', link, game });
      beginJoin(link.roomId, game, spectator, false);
    },
    [activeGameIds, beginJoin],
  );

  const joinListedGame = useCallback(
    (link: GameJoinLink, game: ServerInfo_Game) => {
      startJoin(link, game, false);
    },
    [startJoin],
  );

  const confirmJoin = useCallback(
    (link: GameJoinLink) => {
      if (!isConnected || !isSameGameServer(link, endpoint)) {
        setFlow({
          step: 'notice',
          title: t('GameLink.confirm.title'),
          message: isConnected && needsDesktopPort(link, endpoint)
            ? t('GameLink.desktopPortRequired')
            : t('GameLink.otherServer', { server: serverLabel(link) }),
        });
        return;
      }
      if (!joinedRoomIds[link.roomId]) {
        webClient.request.session.joinRoom(link.roomId);
      }
      setFlow({ step: 'awaitGame', link });
    },
    [isConnected, endpoint, joinedRoomIds, webClient, t],
  );

  useEffect(() => {
    if (flow.step !== 'awaitGame') {
      return;
    }
    if (awaitedGame) {
      joinListedGame(flow.link, awaitedGame);
      return;
    }
    const timer = setTimeout(() => {
      setFlow({
        step: 'notice',
        title: t('GameLink.invalid.title'),
        message: t('GameLink.notFound', { gameId: flow.link.gameId }),
      });
    }, GAME_LINK_WAIT_MS);
    return () => clearTimeout(timer);
  }, [flow, awaitedGame, joinListedGame, t]);

  const joining = flow.step === 'joining' ? flow : null;
  const onLinkJoined = useCallback(
    (gameId: number) => {
      if (joining?.link.gameId === gameId) {
        setFlow(IDLE);
      }
    },
    [joining],
  );

  const joinFailed = joining !== null && joinError !== null;

  const dismissJoinError = () => {
    clearJoinError();
    setFlow(IDLE);
  };

  const cancelJoinPassword = () => {
    cancelPassword();
    setFlow(IDLE);
  };

  const cancelSpectatorConfirmation = () => {
    cancelSpectatorJoin();
    setFlow(IDLE);
  };

  const confirmMessage = (link: GameJoinLink) => {
    const roomName = joinedRoomIds[link.roomId] ? room?.info.name : undefined;
    const args = { description: link.description, gameId: link.gameId, room: roomName, server: serverLabel(link) };
    if (link.description) {
      return roomName ? t('GameLink.confirm.descriptionInRoom', args) : t('GameLink.confirm.description', args);
    }
    return roomName ? t('GameLink.confirm.idInRoom', args) : t('GameLink.confirm.id', args);
  };

  return {
    confirmation: {
      isOpen: flow.step === 'confirm',
      title: t('GameLink.confirm.title'),
      message: flow.step === 'confirm' ? confirmMessage(flow.link) : '',
      confirmLabel: t('GameLink.yes'),
      cancelLabel: t('GameLink.no'),
      onConfirm: () => flow.step === 'confirm' && confirmJoin(flow.link),
      onCancel: close,
    },
    spectatorConfirmation: {
      cancelDefault: true,
      isOpen: spectatorConfirmationRequired,
      title: t('GameLink.confirm.title'),
      message: t('GameLink.full'),
      confirmLabel: t('GameLink.yes'),
      cancelLabel: t('GameLink.no'),
      onConfirm: confirmSpectatorJoin,
      onCancel: cancelSpectatorConfirmation,
    },
    passwordPrompt: {
      isOpen: joining !== null && passwordRequired,
      title: t('GameLink.confirm.title'),
      label: joining?.game.description
        ? t('GameLink.password.description', { description: joining.game.description })
        : t('GameLink.password.id', { gameId: joining?.link.gameId ?? 0 }),
      submitLabel: t('GameLink.join'),
      type: 'password' as const,
      onSubmit: submitPassword,
      onCancel: cancelJoinPassword,
    },
    notice: {
      isOpen: flow.step === 'notice',
      title: flow.step === 'notice' ? flow.title : '',
      message: flow.step === 'notice' ? flow.message : '',
      onDismiss: close,
    },
    error: {
      isOpen: joinFailed,
      title: t('GameLink.confirm.title'),
      message: joinErrorMessage,
      onDismiss: dismissJoinError,
    },
    joining: joining !== null,
    onLinkJoined,
  };
}

function NavigateOnLinkJoin({ onJoined }: { onJoined: (gameId: number) => void }) {
  useNavigateOnGameJoined(onJoined);
  return null;
}

export default function GameLinkJoinHost({ endpoint }: { endpoint: LiveGameServer | null }) {
  const flow = useGameLinkJoinHost(endpoint);
  return (
    <>
      <ConfirmDialog {...flow.confirmation} />
      <ConfirmDialog {...flow.spectatorConfirmation} />
      <PromptDialog {...flow.passwordPrompt} />
      <AlertDialog {...flow.notice} />
      {flow.joining && <NavigateOnLinkJoin onJoined={flow.onLinkJoined} />}
      <AlertDialog {...flow.error} />
    </>
  );
}
