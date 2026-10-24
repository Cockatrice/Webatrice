import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { RequestId } from '@cockatrice/sockatrice/types';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker } from '@app/hooks';
import { onSessionEnd } from '@app/services/session';
import type { AlertDialogNotice } from '@app/dialogs';

export function useRoleChanges(notify: (notice: AlertDialogNotice) => void) {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const describeFailure = useCommandFailureMessage();
  const requests = useRequestTracker();
  const pending = useRef(new Map<RequestId, { userName: string; promoted: boolean }>());
  useEffect(() => onSessionEnd(() => pending.current.clear()), []);

  const settle = (requestId: RequestId | undefined, userName: string) => {
    if (requestId === undefined) {
      return undefined;
    }
    const change = pending.current.get(requestId);
    if (!change || change.userName !== userName || !requests.settle(requestId)) {
      return undefined;
    }
    pending.current.delete(requestId);
    return change;
  };

  useReduxEffect<ReturnType<typeof server.Actions.adjustMod>['payload']>(({ payload }) => {
    const change = settle(payload.requestId, payload.userName);
    if (change) {
      notify({
        title: t('Moderation.common.success'),
        message: t(change.promoted ? 'Moderation.adjustMod.promoted' : 'Moderation.adjustMod.demoted'),
        severity: 'info',
      });
    }
  }, server.Types.ADJUST_MOD, [t, notify]);

  useReduxEffect<ReturnType<typeof server.Actions.adminCommandFailed>['payload']>(({ payload }) => {
    if (payload.command !== 'adjustMod') {
      return;
    }
    const change = settle(payload.requestId, payload.target);
    if (change) {
      notify({
        title: t('Moderation.common.failed'),
        message: describeFailure(payload.failure,
          t(change.promoted ? 'Moderation.adjustMod.promoteFailed' : 'Moderation.adjustMod.demoteFailed')),
        severity: 'info',
      });
    }
  }, server.Types.ADMIN_COMMAND_FAILED, [describeFailure, t, notify]);

  return useCallback((
    userName: string,
    change: { shouldBeMod?: boolean; shouldBeJudge?: boolean; shouldBeDeveloper?: boolean },
  ) => {
    const requestId = requests.begin();
    requests.track(requestId);
    pending.current.set(requestId, {
      userName, promoted: Boolean(change.shouldBeMod || change.shouldBeJudge || change.shouldBeDeveloper),
    });
    webClient.request.admin.adjustMod(userName, change.shouldBeMod, change.shouldBeJudge, change.shouldBeDeveloper, requestId);
  }, [requests, webClient]);
}
