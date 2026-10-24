import { useEffect } from 'react';

import { getKnownHosts } from '@app/feature-widgets/known-hosts';
import { getSettings } from '../../hooks/useSettings';
import type { LoginFormValues } from './forms/LoginForm/loginFormSchema';
import { autoLoginGate } from '../../services/session/autoLoginGate';
import { clearHomeSnapshot, homePreview, loadHomeSnapshot } from '../../services/storage/homeSnapshot';
import { getHostKey } from '@app/utils';

export type AutoLoginValues = Omit<LoginFormValues, 'autoConnect'>;

export { autoLoginGate };

export function useAutoLogin(
  onLogin: (values: AutoLoginValues) => void,
  connectionAttemptMade: boolean,
): void {
  useEffect(() => {
    if (autoLoginGate.hasChecked) {
      return;
    }
    if (connectionAttemptMade) {
      return;
    }

    let cancelled = false;

    Promise.all([getSettings(), getKnownHosts()]).then(([settings, hosts]) => {
      if (cancelled || autoLoginGate.hasChecked) {
        return;
      }
      autoLoginGate.hasChecked = true;

      if (!settings.autoConnect) {
        clearHomeSnapshot();
        return;
      }
      const { selectedHost } = hosts;
      if (!selectedHost?.remember || !selectedHost?.hashedPassword) {
        return;
      }

      homePreview.set(loadHomeSnapshot(getHostKey(selectedHost), selectedHost.userName ?? ''));
      autoLoginGate.source = 'page';
      autoLoginGate.target = getHostKey(selectedHost);
      autoLoginGate.inFlight = true;
      onLogin({
        selectedHost,
        userName: selectedHost.userName ?? '',
        remember: true,
        password: '',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [connectionAttemptMade, onLogin]);
}
