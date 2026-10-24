import type { AlertDialogNotice } from '@app/dialogs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Response_WarnList, ServerInfo_Ban, ServerInfo_User, ServerInfo_Warning } from '@cockatrice/sockatrice/generated';
import type { RequestId, WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useCommandFailureMessage, useOpenUserInvestigation, useReduxEffect, useRequestTracker } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { onSessionEnd } from '@app/services/session';
import { useRoleChanges } from './useRoleChanges';

import type { ModerationAction } from './moderationMenu';
import { banMinutes, type BanUserFormValues, type WarnUserFormValues } from './moderationFormSchemas';

export const REDACT_ALL_MESSAGES = 0xffffffff;

type Stage = 'loading' | 'ready';

export type ModerationFlow =
  | { kind: 'warnUser'; userName: string; stage: Stage; clientId: string | null }
  | { kind: 'banUser'; userName: string; stage: Stage; noUserInfo: boolean }
  | { kind: 'warnHistory' | 'banHistory' | 'adminNotes'; userName: string; stage: Stage };

export interface ModerationFlowState {
  flow: ModerationFlow | null;
  notice: AlertDialogNotice | null;
  userInfo: ServerInfo_User | undefined;
  warnList: Response_WarnList | undefined;
  banHistory: ServerInfo_Ban[] | undefined;
  warnHistory: ServerInfo_Warning[] | undefined;
  adminNotes: string | undefined;
  open: (action: ModerationAction, userName: string) => void;
  close: () => void;
  dismissNotice: () => void;
  submitWarn: (values: WarnUserFormValues) => void;
  submitBan: (values: BanUserFormValues) => void;
  submitAdminNotes: (notes: string) => void;
}

type DialogData = Partial<Pick<ModerationFlowState, 'userInfo' | 'warnList' | 'banHistory' | 'warnHistory' | 'adminNotes'>>;

export function useModerationFlow(): ModerationFlowState {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const webClient = useWebClient();
  const openUserInvestigation = useOpenUserInvestigation();
  const ownName = useAppSelector((state) => server.Selectors.getUser(state)?.name ?? '');
  const requests = useRequestTracker();
  const [flow, setFlowState] = useState<ModerationFlow | null>(null);
  const currentFlow = useRef<ModerationFlow | null>(null);
  const setFlow = useCallback((next: ModerationFlow | null) => {
    currentFlow.current = next;
    setFlowState(next);
  }, []);
  const [data, setData] = useState<DialogData>({});
  const [notices, setNotices] = useState<AlertDialogNotice[]>([]);
  const notify = useCallback((notice: AlertDialogNotice) => setNotices((queue) => [...queue, notice]), []);
  const changeRole = useRoleChanges(notify);
  const close = useCallback(() => {
    requests.cancel();
    setFlow(null);
    setData({});
  }, [requests, setFlow]);
  const dismissNotice = useCallback(() => setNotices((queue) => queue.slice(1)), []);
  useEffect(() => onSessionEnd(() => {
    close();
    setNotices([]);
  }), [close]);

  const beginFlow = useCallback((next: ModerationFlow) => {
    const requestId = requests.begin();
    setData({});
    setFlow(next);
    return requestId;
  }, [requests, setFlow]);

  const open = useCallback((action: ModerationAction, userName: string) => {
    switch (action) {
      case 'warnUser':
        webClient.request.session.getUserInfo(userName, beginFlow({ kind: 'warnUser', userName, stage: 'loading', clientId: null }));
        break;
      case 'banUser':
        webClient.request.session.getUserInfo(userName, beginFlow({ kind: 'banUser', userName, stage: 'loading', noUserInfo: false }));
        break;
      case 'warnHistory':
        webClient.request.moderator.getWarnHistory(userName, beginFlow({ kind: 'warnHistory', userName, stage: 'loading' }));
        break;
      case 'banHistory':
        webClient.request.moderator.getBanHistory(userName, beginFlow({ kind: 'banHistory', userName, stage: 'loading' }));
        break;
      case 'adminNotes':
        webClient.request.moderator.getAdminNotes(userName, beginFlow({ kind: 'adminNotes', userName, stage: 'loading' }));
        break;
      case 'investigateUser':
        openUserInvestigation(userName);
        break;
      case 'promoteMod':
      case 'demoteMod':
        changeRole(userName, { shouldBeMod: action === 'promoteMod' });
        break;
      case 'promoteJudge':
      case 'demoteJudge':
        changeRole(userName, { shouldBeJudge: action === 'promoteJudge' });
        break;
      case 'promoteDeveloper':
      case 'demoteDeveloper':
        changeRole(userName, { shouldBeDeveloper: action === 'promoteDeveloper' });
        break;
    }
  }, [webClient, changeRole, beginFlow, openUserInvestigation]);

  const awaiting = (userName: string, requestId?: RequestId) => {
    const current = currentFlow.current;
    return current?.stage === 'loading' && current.userName === userName && requests.isCurrent(requestId) ? current : null;
  };

  useReduxEffect<ReturnType<typeof server.Actions.getUserInfo>['payload']>(({ payload }) => {
    const current = awaiting(payload.userInfo.name, payload.requestId);
    if (current?.kind === 'banUser') {
      requests.cancel();
      setData({ userInfo: payload.userInfo });
      setFlow({ ...current, stage: 'ready' });
    } else if (current?.kind === 'warnUser' && current.clientId === null) {
      const clientId = payload.userInfo.clientid;
      setData({ userInfo: payload.userInfo });
      setFlow({ ...current, clientId });
      webClient.request.moderator.getWarnList(ownName, current.userName, clientId, requests.begin());
    }
  }, server.Types.GET_USER_INFO, [ownName, requests, setFlow, webClient]);

  useReduxEffect<ReturnType<typeof server.Actions.getUserInfoFailed>['payload']>(({ payload }) => {
    const current = awaiting(payload.userName, payload.requestId);
    if (current?.kind === 'banUser') {
      requests.cancel();
      setFlow({ ...current, stage: 'ready', noUserInfo: true });
    } else if (current?.kind === 'warnUser' && current.clientId === null) {
      setFlow({ ...current, clientId: '' });
      webClient.request.moderator.getWarnList(ownName, current.userName, '', requests.begin());
    }
  }, server.Types.GET_USER_INFO_FAILED, [ownName, requests, setFlow, webClient]);

  useReduxEffect<ReturnType<typeof server.Actions.warnListOptions>['payload']>(({ payload }) => {
    const current = currentFlow.current;
    if (current?.kind !== 'warnUser' || current.clientId === null || !awaiting(current.userName, payload.requestId)) {
      return;
    }
    const warnList = payload.warnList.find((list) => list.userName === current.userName);
    if (warnList) {
      requests.cancel();
      setData((previous) => ({ ...previous, warnList }));
      setFlow({ ...current, stage: 'ready' });
    }
  }, server.Types.WARN_LIST_OPTIONS, [requests, setFlow]);

  useReduxEffect<ReturnType<typeof server.Actions.banHistory>['payload']>(({ payload }) => {
    const current = awaiting(payload.userName, payload.requestId);
    if (current?.kind !== 'banHistory') {
      return;
    }
    requests.cancel();
    if (payload.banHistory.length === 0) {
      close();
      notify({ title: t('Moderation.banHistory.title'), message: t('Moderation.banHistory.empty'), severity: 'info' });
    } else {
      setData({ banHistory: payload.banHistory });
      setFlow({ ...current, stage: 'ready' });
    }
  }, server.Types.BAN_HISTORY, [close, notify, requests, setFlow, t]);

  useReduxEffect<ReturnType<typeof server.Actions.warnHistory>['payload']>(({ payload }) => {
    const current = awaiting(payload.userName, payload.requestId);
    if (current?.kind !== 'warnHistory') {
      return;
    }
    requests.cancel();
    if (payload.warnHistory.length === 0) {
      close();
      notify({ title: t('Moderation.warnHistory.title'), message: t('Moderation.warnHistory.empty'), severity: 'info' });
    } else {
      setData({ warnHistory: payload.warnHistory });
      setFlow({ ...current, stage: 'ready' });
    }
  }, server.Types.WARN_HISTORY, [close, notify, requests, setFlow, t]);

  useReduxEffect<ReturnType<typeof server.Actions.getAdminNotes>['payload']>(({ payload }) => {
    const current = awaiting(payload.userName, payload.requestId);
    if (current?.kind === 'adminNotes') {
      requests.cancel();
      setData({ adminNotes: payload.notes });
      setFlow({ ...current, stage: 'ready' });
    }
  }, server.Types.GET_ADMIN_NOTES, [requests, setFlow]);

  useReduxEffect<ReturnType<typeof server.Actions.moderatorCommandFailed>['payload']>(({ payload }) => {
    const current = awaiting(payload.target, payload.requestId);
    if (!current) {
      return;
    }
    const command = payload.command;
    if (command === 'warnList' && current.kind === 'warnUser' && current.clientId !== null) {
      requests.cancel();
      setFlow({ ...current, stage: 'ready' });
      return;
    }
    const kinds: Partial<Record<WebsocketTypes.ModeratorCommandName, ModerationFlow['kind']>> = {
      banHistory: 'banHistory', warnHistory: 'warnHistory', getAdminNotes: 'adminNotes',
    };
    if (kinds[command] !== current.kind) {
      return;
    }
    const failures: Partial<Record<WebsocketTypes.ModeratorCommandName, AlertDialogNotice>> = {
      banHistory: { title: t('Moderation.banHistory.title'), message: t('Moderation.banHistory.failed'), severity: 'error' },
      warnHistory: { title: t('Moderation.warnHistory.title'), message: t('Moderation.warnHistory.failed'), severity: 'error' },
      getAdminNotes: { title: t('Moderation.common.failed'), message: t('Moderation.adminNotes.failed'), severity: 'info' },
    };
    const failure = failures[command];
    if (failure) {
      close();
      notify({ ...failure, message: describeFailure(payload.failure, failure.message) });
    }
  }, server.Types.MODERATOR_COMMAND_FAILED, [close, describeFailure, notify, requests, setFlow, t]);

  const submitWarn = useCallback((values: WarnUserFormValues) => {
    if (flow?.kind !== 'warnUser' || !ownName) {
      return;
    }
    webClient.request.moderator.warnUser(
      values.userName.trim(),
      values.reason.trim(),
      flow.clientId ?? '',
      values.redact ? REDACT_ALL_MESSAGES : undefined,
    );
    close();
  }, [close, flow, ownName, webClient]);

  const submitBan = useCallback((values: BanUserFormValues) => {
    webClient.request.moderator.banFromServer(
      banMinutes(values),
      values.byName ? values.userName : '',
      values.byIp ? values.address : '',
      values.reason,
      values.visibleReason,
      values.byClientId ? values.clientId : '',
      values.redact ? REDACT_ALL_MESSAGES : undefined,
    );
    close();
  }, [close, webClient]);

  const submitAdminNotes = useCallback((notes: string) => {
    if (flow?.kind === 'adminNotes') {
      webClient.request.moderator.updateAdminNotes(flow.userName, notes);
    }
    close();
  }, [close, flow, webClient]);

  return {
    flow,
    notice: notices[0] ?? null,
    userInfo: data.userInfo,
    warnList: data.warnList,
    banHistory: data.banHistory,
    warnHistory: data.warnHistory,
    adminNotes: data.adminNotes,
    open,
    close,
    dismissNotice,
    submitWarn,
    submitBan,
    submitAdminNotes,
  };
}
