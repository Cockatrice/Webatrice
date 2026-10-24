import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'react-redux';
import { useWebClient } from '@cockatrice/datatrice/react';

import type { RootState } from '@app/store';
import { UserAvatarContext, UserAvatarService } from '@app/services';
import { onSessionEnd } from '@app/services/session';

export function UserAvatarProvider({ children }: { children: ReactNode }) {
  const store = useStore<RootState>();
  const webClient = useWebClient();
  const [service] = useState(() => new UserAvatarService(store, (name) => webClient.request.session.getUserInfo(name)));

  useEffect(() => {
    const unsubscribe = onSessionEnd(() => service.clear());
    return () => {
      unsubscribe();
      service.clear();
    };
  }, [service]);

  return <UserAvatarContext value={service}>{children}</UserAvatarContext>;
}
