import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server, type CommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { Response_ResponseCode, type ServerInfo_ReplayMatch } from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker, useWatchReplay } from '@app/hooks';
import { ReplayFileDTO, ReplayNameTakenError, replayFileName } from '@app/services';
import { sessionGeneration } from '@app/services/session';
import { useAppSelector } from '@app/store';

import { saveReplayFile } from './replayFiles';

export type ServerReplaySelection =
  | { kind: 'match'; gameId: number }
  | { kind: 'replay'; gameId: number; replayId: number };

export interface ReplayNotice {
  title: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export type ServerReplaysAvailability = 'available' | 'disconnected' | 'unregistered';

export interface ServerReplays {
  availability: ServerReplaysAvailability;
  loading: boolean;
  matches: ServerInfo_ReplayMatch[];
  selection: ServerReplaySelection | null;
  selectedMatch: ServerInfo_ReplayMatch | undefined;
  select: (selection: ServerReplaySelection | null) => void;
  watch: (selection?: ServerReplaySelection) => void;
  download: () => void;
  saveToLibrary: (folderId: number, replayIds?: readonly number[]) => void;
  toggleKeep: () => void;
  requestDelete: () => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  deleteConfirmOpen: boolean;
  getShareCode: () => void;
  shareCode: string | null;
  closeShareCode: () => void;
  submitPromptOpen: boolean;
  openSubmitPrompt: () => void;
  closeSubmitPrompt: () => void;
  submitShareCode: (code: string) => void;
  notice: ReplayNotice | null;
  dismissNotice: () => void;
  librarySaves: number;
}

async function matchFolder(parentId: number, name: string): Promise<number> {
  try {
    return await ReplayFileDTO.addFolder(parentId, name);
  } catch (err) {
    const existing = err instanceof ReplayNameTakenError
      ? (await ReplayFileDTO.listFolder(parentId)).find((entry) => entry.kind === 'folder' && entry.name === name)
      : undefined;
    if (existing?.id == null) {
      throw err;
    }
    return existing.id;
  }
}

function replaysOf(match: ServerInfo_ReplayMatch | undefined, selection: ServerReplaySelection | null) {
  if (!match || !selection) {
    return [];
  }
  return selection.kind === 'replay'
    ? match.replayList.filter((r) => r.replayId === selection.replayId)
    : match.replayList;
}

export function useServerReplays(): ServerReplays {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const webClient = useWebClient();
  const watchReplay = useWatchReplay();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const isRegistered = useAppSelector(server.Selectors.getIsUserRegistered);
  const matches = useAppSelector(server.Selectors.getReplaysList);
  const requests = useRequestTracker();

  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<ServerReplaySelection | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [submitPromptOpen, setSubmitPromptOpen] = useState(false);
  const [notice, setNotice] = useState<ReplayNotice | null>(null);
  const [librarySaves, setLibrarySaves] = useState(0);

  const availability: ServerReplaysAvailability = !isConnected
    ? 'disconnected'
    : !isRegistered ? 'unregistered' : 'available';

  const refresh = useCallback(() => {
    setLoading(true);
    setNotice(null);
    webClient.request.session.replayList(requests.begin());
  }, [webClient, requests]);

  useEffect(() => {
    if (availability === 'available') {
      refresh();
    } else {
      requests.cancel();
      setLoading(false);
      setSelection(null);
    }
  }, [availability, refresh, requests]);

  useReduxEffect<ReturnType<typeof server.Actions.replayList>['payload']>(({ payload }) => {
    if (requests.isCurrent(payload.requestId)) {
      requests.cancel();
      setLoading(false);
    }
  }, server.Types.REPLAY_LIST, [requests]);

  const selectedMatch = useMemo(
    () => (selection ? matches.find((m) => m.gameId === selection.gameId) : undefined),
    [matches, selection],
  );

  useEffect(() => {
    if (selection && !selectedMatch) {
      setSelection(null);
    }
  }, [selection, selectedMatch]);

  const showError = useCallback((title: string, message: string) => {
    setNotice({ title, message, severity: 'error' });
  }, []);

  useReduxEffect<CommandFailedPayload>(({ payload: { failure, requestId } }) => {
    if (availability !== 'available' || !requests.isCurrent(requestId)) {
      return;
    }
    requests.cancel();
    setLoading(false);
    showError(t('Replays.notice.failed'), describeFailure(failure, t('Replays.server.listFailed')));
  }, server.Types.REPLAY_LIST_FAILED, [availability, requests, showError, describeFailure, t]);

  const failed = useCallback(
    (message: string) => (_responseCode: number, failure?: WebsocketTypes.CommandFailure) =>
      showError(t('Replays.notice.failed'), describeFailure(failure, message)),
    [showError, describeFailure, t],
  );

  const watch = useCallback((target: ServerReplaySelection | undefined = selection ?? undefined) => {
    if (target?.kind !== 'replay') {
      return;
    }
    const match = matches.find((m) => m.gameId === target.gameId);
    const title = match?.gameName
      ? t('Replays.server.matchReplayTitle', { name: match.gameName, id: target.replayId })
      : t('Replays.server.replayTitle', { id: target.replayId });
    webClient.request.session.replayDownload(
      target.replayId,
      (data) => {
        try {
          watchReplay(data, title);
        } catch {
          showError(t('Replays.notice.failed'), t('Replays.server.unreadable'));
        }
      },
      failed(t('Replays.server.downloadFailed')),
    );
  }, [selection, matches, webClient, watchReplay, showError, failed, t]);

  const download = useCallback(() => {
    for (const replay of replaysOf(selectedMatch, selection)) {
      webClient.request.session.replayDownload(
        replay.replayId,
        (data) => saveReplayFile(data, replayFileName(replay.replayId)),
        failed(t('Replays.server.downloadFailed')),
      );
    }
  }, [selectedMatch, selection, webClient, failed, t]);

  const saveToLibrary = useCallback((folderId: number, replayIds?: readonly number[]) => {
    const replays = replaysOf(selectedMatch, selection).filter((r) => !replayIds || replayIds.includes(r.replayId));
    if (!replays.length || !selectedMatch) {
      return;
    }
    const endpoint = webClient.socket.connectedEndpoint ?? '';
    const gameId = selectedMatch.gameId;
    const generation = sessionGeneration();
    const folder = selection?.kind === 'match'
      ? matchFolder(folderId, `${selectedMatch.gameId}_${selectedMatch.gameName}`)
      : Promise.resolve(folderId);
    folder.then((targetId) => {
      if (sessionGeneration() !== generation) {
        return;
      }
      for (const replay of replays) {
        webClient.request.session.replayDownload(
          replay.replayId,
          (data) => {
            if (sessionGeneration() !== generation) {
              return;
            }
            ReplayFileDTO.addReplay(targetId, replayFileName(replay.replayId), data, { endpoint, gameId, replayId: replay.replayId })
              .then(() => setLibrarySaves((n) => n + 1))
              .catch(() => showError(t('Replays.notice.failed'), t('Replays.local.saveFailed')));
          },
          failed(t('Replays.server.downloadFailed')),
        );
      }
    }, () => showError(t('Replays.notice.failed'), t('Replays.local.saveFailed')));
  }, [selectedMatch, selection, webClient, showError, failed, t]);

  const toggleKeep = useCallback(() => {
    if (!selectedMatch) {
      return;
    }
    webClient.request.session.replayModifyMatch(
      selectedMatch.gameId,
      !selectedMatch.doNotHide,
      failed(t('Replays.server.keepFailed')),
    );
  }, [selectedMatch, webClient, failed, t]);

  const requestDelete = useCallback(() => {
    if (selectedMatch) {
      setDeleteConfirmOpen(true);
    }
  }, [selectedMatch]);

  const confirmDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    if (!selectedMatch) {
      return;
    }
    webClient.request.session.replayDeleteMatch(selectedMatch.gameId, failed(t('Replays.server.deleteFailed')));
  }, [selectedMatch, webClient, failed, t]);

  const getShareCode = useCallback(() => {
    if (!selectedMatch) {
      return;
    }
    webClient.request.session.replayGetCode(
      selectedMatch.gameId,
      (code) => setShareCode(code),
      (responseCode, failure) => {
        if (responseCode === Response_ResponseCode.RespFunctionNotAllowed) {
          showError(t('Replays.share.getFailedTitle'), t('Replays.share.notPermitted'));
        } else {
          showError(t('Replays.notice.failed'), describeFailure(failure, t('Replays.share.getFailed')));
        }
      },
    );
  }, [selectedMatch, webClient, showError, describeFailure, t]);

  const submitShareCode = useCallback((code: string) => {
    setSubmitPromptOpen(false);
    webClient.request.session.replaySubmitCode(
      code,
      () => setNotice({
        title: t('Replays.share.foundTitle'),
        message: t('Replays.share.found'),
        severity: 'info',
      }),
      (responseCode, failure) => {
        if (responseCode === Response_ResponseCode.RespNameNotFound) {
          showError(t('Replays.notice.failed'), t('Replays.share.notFound'));
        } else if (responseCode === Response_ResponseCode.RespFunctionNotAllowed) {
          showError(t('Replays.share.submitFailedTitle'), t('Replays.share.notPermitted'));
        } else {
          showError(t('Replays.notice.failed'), describeFailure(failure, t('Replays.share.unexpected')));
        }
      },
    );
  }, [webClient, showError, describeFailure, t]);

  return {
    availability,
    loading,
    matches: availability === 'available' ? matches : [],
    selection,
    selectedMatch,
    select: setSelection,
    watch,
    download,
    saveToLibrary,
    toggleKeep,
    requestDelete,
    confirmDelete,
    cancelDelete: () => setDeleteConfirmOpen(false),
    deleteConfirmOpen,
    getShareCode,
    shareCode,
    closeShareCode: () => setShareCode(null),
    submitPromptOpen,
    openSubmitPrompt: () => setSubmitPromptOpen(true),
    closeSubmitPrompt: () => setSubmitPromptOpen(false),
    submitShareCode,
    notice,
    dismissNotice: () => setNotice(null),
    librarySaves,
  };
}
