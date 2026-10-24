import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReportStatus, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';
import type { RequestId, WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useReduxEffect, useRequestTracker, useWatchReplay, type ReduxEffectAction } from '@app/hooks';
import { useAppDispatch, useAppSelector } from '@app/store';

import { useJoinReportGame } from './useJoinReportGame';
import { useReportListLoad, type ReportListLoadState } from './useReportListLoad';
import { useReportThread, type ReportThread } from './useReportThread';
import { reportQueueQuery, reportQueueViewCounts, type ReportQueueView } from './reportQueueView';

export const REPORT_QUEUE_REFRESH_MS = 300_000;

export type QueueActionMessage =
  | 'assigning' | 'assignedDone' | 'assignFailed'
  | 'resolving' | 'dismissing' | 'done' | 'actionFailed'
  | 'loadingReplay' | 'noReplay' | 'replayOpened' | 'replayParseFailed'
  | 'noRoom' | 'joining';

export interface ResolvePrompt {
  dismissed: boolean;
}

export interface ReportQueueActions {
  canAssign: boolean;
  canResolve: boolean;
  canViewReplay: boolean;
  canJoinGame: boolean;
}

export interface ReportQueue {
  search: string;
  setSearch: (value: string) => void;
  view: ReportQueueView;
  setView: (view: ReportQueueView) => void;
  viewCounts: Record<ReportQueueView, number | null>;
  reports: ServerInfo_Report[];
  totalCount: number;
  loadedCount: number;
  loadState: ReportListLoadState;
  refresh: () => void;
  selectedId: number | null;
  selected: ServerInfo_Report | undefined;
  select: (reportId: number | null) => void;
  thread: ReportThread;
  actions: ReportQueueActions;
  actionMessage: QueueActionMessage | null;
  assign: () => void;
  resolve: () => void;
  promptResolve: (dismissed: boolean) => void;
  resolvePrompt: ResolvePrompt | null;
  submitResolvePrompt: (note: string) => void;
  cancelResolvePrompt: () => void;
  viewReplay: () => void;
  joinGame: () => void;
  userInfoFailed: boolean;
  statsState: ReportListLoadState;
}

const QUEUE_LIST_FAILURE = {
  type: server.Types.MODERATOR_COMMAND_FAILED, command: 'reportList', successType: server.Actions.reportList.type,
};

interface PendingMutation {
  command: 'reportAssign' | 'reportResolve';
  reportId: number;
}

const NO_ACTIONS: ReportQueueActions = { canAssign: false, canResolve: false, canViewReplay: false, canJoinGame: false };

export function useReportQueue(): ReportQueue {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const watchReplay = useWatchReplay();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ReportQueueView>('unresolved');
  const { unresolvedOnly, status: statusFilter } = reportQueueQuery(view);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<QueueActionMessage | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [resolvePrompt, setResolvePrompt] = useState<ResolvePrompt | null>(null);
  const pendingReplayGameId = useRef<number | null>(null);
  const [userInfoFailedFor, setUserInfoFailedFor] = useState<string | null>(null);
  const [statsState, setStatsState] = useState<ReportListLoadState>('loading');

  const queue = useAppSelector(server.Selectors.getReportQueue);
  const totalCount = useAppSelector(server.Selectors.getReportQueueTotalCount);
  const statusCounts = useAppSelector(server.Selectors.getReportQueueStatusCounts);
  const lastNotice = useAppSelector(server.Selectors.getLastReportNotice);
  const joinReportGame = useJoinReportGame();

  const statsRequest = useRequestTracker();
  const userInfoRequest = useRequestTracker();
  const actionRequest = useRequestTracker();
  const pendingMutation = useRef<PendingMutation | null>(null);
  const cancelAction = useCallback(() => {
    actionRequest.cancel();
    pendingMutation.current = null;
    pendingReplayGameId.current = null;
    setActionBusy(false);
    setActionMessage(null);
    setResolvePrompt(null);
  }, [actionRequest]);

  const reports = useMemo(
    () => server.filterReports(queue, search, statusFilter),
    [queue, search, statusFilter],
  );
  const selected = useMemo(() => reports.find((r) => r.reportId === selectedId), [reports, selectedId]);

  const send = useCallback(
    (requestId: RequestId) => webClient.request.moderator.reportList(unresolvedOnly, undefined, undefined, requestId),
    [webClient, unresolvedOnly],
  );
  const { loadState, refresh: refreshList } = useReportListLoad(send, QUEUE_LIST_FAILURE);

  useReduxEffect((action: ReduxEffectAction<{ requestId?: RequestId }>) => {
    if (statsRequest.isCurrent(action.payload.requestId)) {
      statsRequest.cancel();
      setStatsState('ready');
    }
  }, server.Actions.reportStats.type, [statsRequest]);

  const requestStats = useCallback(() => {
    const requestId = statsRequest.begin();
    setStatsState('loading');
    webClient.request.moderator.reportStats(requestId);
  }, [webClient, statsRequest]);

  const selectedReportId = selected?.reportId;
  useEffect(() => {
    cancelAction();
  }, [selectedReportId, cancelAction]);

  const thread = useReportThread(selected ? selectedId : null, () => refresh());
  const { reloadDetails } = thread;

  const refresh = useCallback(() => {
    cancelAction();
    userInfoRequest.cancel();
    setUserInfoFailedFor(null);
    refreshList();
    reloadDetails();
    requestStats();
  }, [refreshList, reloadDetails, requestStats, cancelAction, userInfoRequest]);

  useEffect(() => {
    cancelAction();
    userInfoRequest.cancel();
    setUserInfoFailedFor(null);
    refreshList();
    requestStats();
  }, [refreshList, requestStats, cancelAction, userInfoRequest]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, REPORT_QUEUE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const seenNotice = useRef(lastNotice);
  useEffect(() => {
    if (lastNotice && lastNotice !== seenNotice.current) {
      seenNotice.current = lastNotice;
      refresh();
    }
  }, [lastNotice, refresh]);

  const reportedUser = selected?.reportedUserName ?? '';
  useEffect(() => {
    userInfoRequest.cancel();
    setUserInfoFailedFor(null);
    if (!reportedUser) {
      return;
    }
    dispatch(server.Actions.userInvestigationStarted({ userName: reportedUser }));
    webClient.request.moderator.reportUserInfo(reportedUser, userInfoRequest.begin());
    return userInfoRequest.cancel;
  }, [dispatch, reportedUser, webClient, userInfoRequest]);

  useReduxEffect((action: ReduxEffectAction<{ requestId?: RequestId }>) => {
    if (userInfoRequest.isCurrent(action.payload.requestId)) {
      userInfoRequest.cancel();
    }
  }, server.Types.USER_INFO_REPORT, [userInfoRequest]);

  useReduxEffect((action: ReduxEffectAction<{ gameId: number; replayData: Uint8Array; requestId?: RequestId }>) => {
    const { gameId, replayData } = action.payload;
    if (!actionRequest.isCurrent(action.payload.requestId) || gameId !== pendingReplayGameId.current) {
      return;
    }
    actionRequest.cancel();
    pendingReplayGameId.current = null;
    setActionBusy(false);
    try {
      watchReplay(replayData, t('Reports.queue.replayTitle', { gameId }));
      setActionMessage('replayOpened');
    } catch {
      setActionMessage('replayParseFailed');
    }
  }, server.Types.REPORT_REPLAY_DOWNLOADED, [watchReplay, t, actionRequest]);

  const actions = useMemo<ReportQueueActions>(() => {
    if (!selected || actionBusy) {
      return NO_ACTIONS;
    }
    const open = server.isReportOpen(selected.status);
    const hasGame = selected.gameId > 0;
    return {
      canAssign: selected.status === ReportStatus.OPEN,
      canResolve: open,
      canViewReplay: hasGame && selected.replayId > 0,
      canJoinGame: hasGame && selected.roomId > 0,
    };
  }, [selected, actionBusy]);

  const finish = useCallback((message: QueueActionMessage, reload: boolean) => {
    actionRequest.cancel();
    setActionBusy(false);
    if (reload) {
      refresh();
    }
    setActionMessage(message);
  }, [refresh, actionRequest]);

  useReduxEffect((action: ReduxEffectAction<{ reportId: number; requestId?: RequestId }>) => {
    const pending = pendingMutation.current;
    const command = action.type === server.Types.REPORT_ASSIGNED ? 'reportAssign' : 'reportResolve';
    if (actionRequest.isCurrent(action.payload.requestId)
      && pending?.command === command && pending.reportId === action.payload.reportId) {
      pendingMutation.current = null;
      finish(command === 'reportAssign' ? 'assignedDone' : 'done', true);
    }
  }, [server.Types.REPORT_ASSIGNED, server.Types.REPORT_RESOLVED], [finish, actionRequest]);

  useReduxEffect((action: ReduxEffectAction<{
    command: WebsocketTypes.ModeratorCommandName; target: string; requestId?: RequestId;
  }>) => {
    const { command, target, requestId } = action.payload;
    const pending = pendingMutation.current;
    switch (command) {
      case 'reportUserInfo':
        if (target === reportedUser && userInfoRequest.isCurrent(requestId)) {
          userInfoRequest.cancel();
          setUserInfoFailedFor(target);
        }
        break;
      case 'reportStats':
        if (statsRequest.isCurrent(requestId)) {
          statsRequest.cancel();
          setStatsState('failed');
        }
        break;
      case 'reportAssign':
      case 'reportResolve':
        if (actionRequest.isCurrent(requestId) && pending?.command === command && String(pending.reportId) === target) {
          pendingMutation.current = null;
          finish(command === 'reportAssign' ? 'assignFailed' : 'actionFailed', false);
        }
        break;
      case 'replayDownloadByGameId':
        if (actionRequest.isCurrent(requestId) && pendingReplayGameId.current !== null && String(pendingReplayGameId.current) === target) {
          pendingReplayGameId.current = null;
          finish('noReplay', false);
        }
        break;
      default:
        break;
    }
  }, server.Types.MODERATOR_COMMAND_FAILED, [finish, reportedUser, userInfoRequest, statsRequest, actionRequest]);

  const assign = useCallback(() => {
    if (!selected) {
      return;
    }
    setActionBusy(true);
    setActionMessage('assigning');
    pendingMutation.current = { command: 'reportAssign', reportId: selected.reportId };
    webClient.request.moderator.reportAssign(selected.reportId, actionRequest.begin());
  }, [selected, webClient, actionRequest]);

  const sendResolve = useCallback((dismissed: boolean, note: string) => {
    if (!selected) {
      return;
    }
    setActionBusy(true);
    setActionMessage(dismissed ? 'dismissing' : 'resolving');
    pendingMutation.current = { command: 'reportResolve', reportId: selected.reportId };
    webClient.request.moderator.reportResolve(selected.reportId, note || undefined, dismissed, actionRequest.begin());
  }, [selected, webClient, actionRequest]);

  const viewReplay = useCallback(() => {
    if (!selected || selected.gameId <= 0) {
      return;
    }
    setActionBusy(true);
    setActionMessage('loadingReplay');
    pendingReplayGameId.current = selected.gameId;
    webClient.request.moderator.replayDownloadByGameId(selected.gameId, actionRequest.begin());
  }, [selected, webClient, actionRequest]);

  const joinGame = useCallback(() => {
    if (!selected || selected.gameId <= 0) {
      return;
    }
    if (selected.roomId <= 0) {
      setActionMessage('noRoom');
      return;
    }
    setActionMessage('joining');
    joinReportGame(selected.gameId, selected.roomId);
  }, [selected, joinReportGame]);

  return {
    search,
    setSearch,
    view,
    setView,
    viewCounts: reportQueueViewCounts(view, statusCounts),
    reports,
    totalCount,
    loadedCount: queue.length,
    loadState,
    refresh,
    selectedId: selected ? selectedId : null,
    selected,
    select: setSelectedId,
    thread,
    actions,
    actionMessage,
    assign,
    resolve: () => sendResolve(false, ''),
    promptResolve: (dismissed) => setResolvePrompt({ dismissed }),
    resolvePrompt,
    submitResolvePrompt: (note) => {
      const prompt = resolvePrompt;
      setResolvePrompt(null);
      if (prompt) {
        sendResolve(prompt.dismissed, note.trim());
      }
    },
    cancelResolvePrompt: () => setResolvePrompt(null),
    viewReplay,
    joinGame,
    userInfoFailed: userInfoFailedFor !== null && userInfoFailedFor === reportedUser,
    statsState,
  };
}
