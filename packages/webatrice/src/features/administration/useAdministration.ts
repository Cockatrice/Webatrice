import type { AlertDialogNotice } from '@app/dialogs';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePushToast } from '@app/components';
import { useAdminLock, useCommandFailureMessage, useReduxEffect, useUserCapabilities } from '@app/hooks';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { useModeratorFunctions } from './useModeratorFunctions';

export interface Administration {
  adminFunctionsEnabled: boolean;
  moderatorFunctionsEnabled: boolean;
  isAdmin: boolean;
  locked: boolean;
  unlock: () => void;
  shutdownDialogOpen: boolean;
  openShutdownDialog: () => void;
  closeShutdownDialog: () => void;
  updateServerMessage: () => void;
  shutdownServer: (reason: string, minutes: number) => void;
  reloadConfig: () => void;
  grantReplayAccess: (replayId: number) => void;
  forceActivateUser: (userName: string) => void;
  notice: AlertDialogNotice | null;
  dismissNotice: () => void;
}

interface AdminFailedPayload { command: WebsocketTypes.AdminCommandName; failure?: WebsocketTypes.CommandFailure }

const ADMIN_FAILURE_KEYS: Partial<Record<WebsocketTypes.AdminCommandName, string>> = {
  updateServerMessage: 'Administration.result.serverMessageFailed',
  shutdownServer: 'Administration.result.shutdownFailed',
  reloadConfig: 'Administration.result.configReloadFailed',
};

export function useAdministration(): Administration {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const pushToast = usePushToast();
  const describeFailure = useCommandFailureMessage();
  const { isAdmin } = useUserCapabilities();
  const [locked, setLocked] = useAdminLock();
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [notice, setNotice] = useState<AlertDialogNotice | null>(null);

  const { grantReplayAccess, forceActivateUser } = useModeratorFunctions(setNotice);

  useReduxEffect(() => {
    pushToast(t('Administration.result.serverMessageUpdated'));
  }, server.Types.UPDATE_SERVER_MESSAGE, [t, pushToast]);
  useReduxEffect(() => {
    pushToast(t('Administration.result.shutdownScheduled'));
  }, server.Types.SHUTDOWN_SERVER, [t, pushToast]);
  useReduxEffect(() => {
    pushToast(t('Administration.result.configReloaded'));
  }, server.Types.RELOAD_CONFIG, [t, pushToast]);

  useReduxEffect<AdminFailedPayload>(({ payload }) => {
    const key = ADMIN_FAILURE_KEYS[payload.command];
    if (key) {
      setNotice({ title: t('Administration.result.errorTitle'), message: describeFailure(payload.failure, t(key)), severity: 'error' });
    }
  }, server.Types.ADMIN_COMMAND_FAILED, [t, describeFailure]);

  const shutdownServer = useCallback((reason: string, minutes: number) => {
    setShutdownDialogOpen(false);
    webClient.request.admin.shutdownServer(reason, minutes);
  }, [webClient]);

  return {
    adminFunctionsEnabled: isAdmin && !locked,
    moderatorFunctionsEnabled: !locked,
    isAdmin,
    locked,
    unlock: () => setLocked(false),
    shutdownDialogOpen,
    openShutdownDialog: () => setShutdownDialogOpen(true),
    closeShutdownDialog: () => setShutdownDialogOpen(false),
    updateServerMessage: () => webClient.request.admin.updateServerMessage(),
    shutdownServer,
    reloadConfig: () => webClient.request.admin.reloadConfig(),
    grantReplayAccess,
    forceActivateUser,
    notice,
    dismissNotice: () => setNotice(null),
  };
}
