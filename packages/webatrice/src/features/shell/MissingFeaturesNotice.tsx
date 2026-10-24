import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { AlertDialog } from '@app/dialogs';
import { useKnownHosts } from '@app/feature-widgets/known-hosts';
import { getPreferencesSnapshot, LoadingState, useReduxEffect } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { getHostKey } from '@app/utils';

export const notifiedServers = new Set<string>();

export default function MissingFeaturesNotice() {
  const { t } = useTranslation();
  const knownHosts = useKnownHosts();
  const serverName = useAppSelector(server.Selectors.getName);
  const [open, setOpen] = useState(false);
  const selectedHost = knownHosts.status === LoadingState.READY ? knownHosts.value?.selectedHost : undefined;
  const serverKey = useRef('');
  serverKey.current = selectedHost ? getHostKey(selectedHost) : serverName;

  useReduxEffect<{ options: WebsocketTypes.LoginSuccessContext }>(({ payload: { options } }) => {
    if (!options.missingFeatures?.length || !getPreferencesSnapshot().notifyAboutMissingFeatures) {
      return;
    }
    if (notifiedServers.has(serverKey.current)) {
      return;
    }
    notifiedServers.add(serverKey.current);
    setOpen(true);
  }, server.Types.LOGIN_SUCCESSFUL, []);

  return (
    <AlertDialog
      isOpen={open}
      severity="info"
      title={t('MissingFeaturesNotice.title')}
      message={t('MissingFeaturesNotice.message')}
      onDismiss={() => setOpen(false)}
    />
  );
}
