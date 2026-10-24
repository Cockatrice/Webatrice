import type { AlertDialogNotice } from '@app/dialogs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  INVESTIGATE_USER_PARAM,
  useCommandFailureMessage,
  useReduxEffect,
  userInvestigationPath,
  useRequestTracker,
  useUserCapabilities,
  type ReduxEffectAction,
} from '@app/hooks';
import { server, type UserInvestigation } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Response_ReportUserInfo, ServerInfo_ModeratorLogin, ServerInfo_User } from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useAppDispatch, useAppSelector } from '@app/store';

import { useModerationParts, type ModerationParts } from './moderationParts';

export type InvestigationPart = 'info' | 'alts' | 'sessions';

type PartFlags = Record<InvestigationPart, boolean>;

const NONE: PartFlags = { info: false, alts: false, sessions: false };
const ALL: PartFlags = { info: true, alts: true, sessions: true };
const INFO_ONLY: PartFlags = { info: true, alts: false, sessions: false };

export type ModerationConfirm = 'resetPassword' | 'removeAvatar';

export interface TemporaryPassword {
  userName: string;
  temporaryPassword: string;
}

export interface Moderation {
  parts: ModerationParts;
  currentUser: string;
  investigate: (userName: string) => void;
  investigation: UserInvestigation;
  userInfo: ServerInfo_User | undefined;
  pending: PartFlags;
  failed: PartFlags;
  infoError: string | null;
  staffLogins: ServerInfo_ModeratorLogin[] | null;
  refreshStaffLogins: () => void;
  canResetPassword: boolean;
  canRemoveAvatar: boolean;
  confirm: ModerationConfirm | null;
  requestConfirm: (action: ModerationConfirm) => void;
  cancelConfirm: () => void;
  confirmAction: () => void;
  temporaryPassword: TemporaryPassword | null;
  dismissTemporaryPassword: () => void;
  notice: AlertDialogNotice | null;
  dismissNotice: () => void;
}

const simplified = (value: string): string => value.replace(/\s+/g, ' ').trim();

interface FailedPayload { command: WebsocketTypes.ModeratorCommandName; target: string; failure?: WebsocketTypes.CommandFailure }

const LOOKUP_PARTS: Partial<Record<WebsocketTypes.ModeratorCommandName, InvestigationPart>> = {
  reportUserInfo: 'info',
  getUserAlts: 'alts',
  getUserSessions: 'sessions',
};

export function useModeration(): Moderation {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedUser = simplified(searchParams.get(INVESTIGATE_USER_PARAM) ?? '');

  const { isAdmin } = useUserCapabilities();
  const parts = useModerationParts();
  const storedLogins = useAppSelector(server.Selectors.getModeratorLastLogins);

  const [currentUser, setCurrentUser] = useState('');
  const currentUserRef = useRef('');
  const [pending, setPending] = useState<PartFlags>(NONE);
  const [failed, setFailed] = useState<PartFlags>(NONE);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [staffFailed, setStaffFailed] = useState(false);
  const [confirm, setConfirm] = useState<ModerationConfirm | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<TemporaryPassword | null>(null);
  const [notice, setNotice] = useState<AlertDialogNotice | null>(null);
  const pendingAvatarRemovals = useRef(new Set<string>());

  const stored = useAppSelector((state) => server.Selectors.getUserInvestigation(state, currentUser));
  const lookup = useRequestTracker();
  const [infoName, setInfoName] = useState('');
  const storedUserInfo = useAppSelector((state) => server.Selectors.getUserInfoByName(state, infoName));

  const settle = useCallback((part: InvestigationPart, userName: string, ok: boolean) => {
    if (userName !== currentUserRef.current) {
      return;
    }
    setPending((p) => ({ ...p, [part]: false }));
    if (!ok) {
      setFailed((f) => ({ ...f, [part]: true }));
    }
  }, []);

  useReduxEffect((action: ReduxEffectAction<{ info: Response_ReportUserInfo }>) => {
    settle('info', action.payload.info.userName, true);
  }, server.Types.USER_INFO_REPORT, [settle]);
  useReduxEffect((action: ReduxEffectAction<{ userInfo: ServerInfo_User; requestId?: string }>) => {
    if (lookup.isCurrent(action.payload.requestId)) {
      setInfoName(action.payload.userInfo.name);
      setPending((p) => ({ ...p, info: false }));
    }
  }, server.Types.GET_USER_INFO, [lookup]);
  useReduxEffect((action: ReduxEffectAction<{ requestId?: string }>) => {
    if (lookup.isCurrent(action.payload.requestId)) {
      setInfoError(t('ModerationPage.info.loadError'));
      setPending((p) => ({ ...p, info: false }));
      setFailed((f) => ({ ...f, info: true }));
    }
  }, server.Types.GET_USER_INFO_FAILED, [lookup, t]);
  useReduxEffect((action: ReduxEffectAction<{ userName: string }>) => {
    settle('alts', action.payload.userName, true);
  }, server.Types.USER_ALTS, [settle]);
  useReduxEffect((action: ReduxEffectAction<{ userName: string }>) => {
    settle('sessions', action.payload.userName, true);
  }, server.Types.USER_SESSIONS, [settle]);

  const errorNotice = useCallback((message: string) => {
    setNotice({ title: t('ModerationPage.notice.errorTitle'), message, severity: 'error' });
  }, [t]);

  useReduxEffect((action: ReduxEffectAction<{ userName: string }>) => {
    const { userName } = action.payload;
    if (pendingAvatarRemovals.current.delete(userName.toLowerCase())) {
      setNotice({
        title: t('ModerationPage.notice.avatarRemovedTitle'),
        message: t('ModerationPage.notice.avatarRemoved', { userName }),
        severity: 'info',
      });
    }
  }, server.Types.USER_AVATAR_REMOVED, [t]);

  useReduxEffect((action: ReduxEffectAction<FailedPayload>) => {
    const { command, target, failure } = action.payload;
    const part = LOOKUP_PARTS[command];
    if (part) {
      if (part === 'info' && target === currentUserRef.current) {
        setInfoError(describeFailure(failure, t('ModerationPage.info.loadError')));
      }
      settle(part, target, false);
    } else if (command === 'getModeratorLastLogins') {
      setStaffFailed(true);
    } else if (command === 'removeUserAvatar' && pendingAvatarRemovals.current.delete(target.toLowerCase())) {
      errorNotice(describeFailure(failure, t('ModerationPage.notice.avatarFailed')));
    }
  }, server.Types.MODERATOR_COMMAND_FAILED, [settle, describeFailure, errorNotice, t]);

  const runInvestigation = useCallback((userName: string) => {
    currentUserRef.current = userName;
    dispatch(server.Actions.userInvestigationStarted({ userName }));
    setCurrentUser(userName);
    setFailed(NONE);
    setInfoError(null);
    if (!parts.investigation) {
      setPending(INFO_ONLY);
      setInfoName(userName);
      webClient.request.session.getUserInfo(userName, lookup.begin());
      return;
    }
    setPending(ALL);
    const moderator = webClient.request.moderator;
    moderator.reportUserInfo(userName);
    moderator.getUserSessions(userName);
    moderator.getUserAlts(userName);
  }, [dispatch, webClient, parts.investigation, lookup]);

  const refreshStaffLogins = useCallback(() => {
    if (!parts.staffLogins) {
      return;
    }
    setStaffFailed(false);
    webClient.request.moderator.getModeratorLastLogins();
  }, [webClient, parts.staffLogins]);

  useEffect(() => {
    refreshStaffLogins();
  }, [refreshStaffLogins]);

  useEffect(() => {
    if (requestedUser) {
      runInvestigation(requestedUser);
    }
  }, [requestedUser, location.key, runInvestigation]);

  const investigate = (userName: string) => {
    const name = simplified(userName);
    if (name) {
      navigate(userInvestigationPath(name), { replace: true });
    }
  };

  const shown = (part: InvestigationPart) => !pending[part] && !failed[part];
  const investigation: UserInvestigation = {
    info: shown('info') ? stored?.info : undefined,
    alts: shown('alts') ? stored?.alts : undefined,
    sessions: shown('sessions') ? stored?.sessions : undefined,
  };

  const resetPassword = (userName: string) => {
    webClient.request.admin.resetUserPassword(
      userName,
      (resetName, password) => setTemporaryPassword({ userName: resetName, temporaryPassword: password }),
      (_responseCode, failure) => errorNotice(describeFailure(failure, t('ModerationPage.notice.resetFailed'))),
    );
  };

  const removeAvatar = (userName: string) => {
    pendingAvatarRemovals.current.add(userName.toLowerCase());
    webClient.request.moderator.removeUserAvatar(userName);
  };

  const confirmAction = () => {
    const action = confirm;
    setConfirm(null);
    if (!currentUser) {
      return;
    }
    if (action === 'resetPassword') {
      resetPassword(currentUser);
    } else if (action === 'removeAvatar') {
      removeAvatar(currentUser);
    }
  };

  return {
    parts,
    currentUser,
    investigate,
    investigation,
    userInfo: !parts.investigation && shown('info') ? storedUserInfo : undefined,
    pending,
    failed,
    infoError,
    staffLogins: staffFailed ? null : storedLogins,
    refreshStaffLogins,
    canResetPassword: isAdmin && parts.resetPassword,
    canRemoveAvatar: parts.removeAvatar,
    confirm,
    requestConfirm: setConfirm,
    cancelConfirm: () => setConfirm(null),
    confirmAction,
    temporaryPassword,
    dismissTemporaryPassword: () => setTemporaryPassword(null),
    notice,
    dismissNotice: () => setNotice(null),
  };
}
