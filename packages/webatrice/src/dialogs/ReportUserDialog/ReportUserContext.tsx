import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { server, ServerCapability } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { DialogReturnFocusContext, closestList } from '@app/hooks';
import { useAppSelector } from '@app/store';

import ReportUserDialog, { type OpenReportUserParams } from './ReportUserDialog';

export interface ReportChatScopeValue {
  gameId?: number;
  getChatContext?: () => string;
}

const ReportChatScopeContext = createContext<ReportChatScopeValue>({});

export function ReportChatScope({ children, gameId, getChatContext }: ReportChatScopeValue & { children: ReactNode }) {
  const value = useMemo(() => ({ gameId, getChatContext }), [gameId, getChatContext]);
  return <ReportChatScopeContext.Provider value={value}>{children}</ReportChatScopeContext.Provider>;
}

const OpenReportUserContext = createContext<(params: OpenReportUserParams) => void>(() => {});

export function ReportUserProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<OpenReportUserParams | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const open = useCallback((params: OpenReportUserParams) => {
    setRequest(params);
    setRequestKey((key) => key + 1);
  }, []);
  const close = useCallback(() => setRequest(null), []);

  return (
    <OpenReportUserContext.Provider value={open}>
      {children}
      <DialogReturnFocusContext.Provider value={closestList}>
        {request && <ReportUserDialog key={requestKey} request={request} onClose={close} />}
      </DialogReturnFocusContext.Provider>
    </OpenReportUserContext.Provider>
  );
}

export interface ReportUserActions {
  reportingAvailable: boolean;
  canReportUser: (userName: string) => boolean;
  openReportUser: (params: OpenReportUserParams) => void;
}

export function useReportUser(): ReportUserActions {
  const open = useContext(OpenReportUserContext);
  const scope = useContext(ReportChatScopeContext);
  const supported = useAppSelector((state) => server.Selectors.supports(state, ServerCapability.REPORTS));
  const self = useAppSelector(server.Selectors.getUser);

  const registered = !!self
    && (self.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) === ServerInfo_User_UserLevelFlag.IsRegistered;
  const selfName = self?.name;

  const reportingAvailable = supported && registered;
  const canReportUser = useCallback(
    (userName: string) => reportingAvailable && !!userName && userName !== selfName,
    [reportingAvailable, selfName],
  );

  const openReportUser = useCallback((params: OpenReportUserParams) => {
    open({
      userName: params.userName,
      gameId: params.gameId ?? scope.gameId,
      chatContext: params.chatContext ?? scope.getChatContext?.(),
    });
  }, [open, scope]);

  return useMemo(
    () => ({ reportingAvailable, canReportUser, openReportUser }),
    [reportingAvailable, canReportUser, openReportUser],
  );
}
