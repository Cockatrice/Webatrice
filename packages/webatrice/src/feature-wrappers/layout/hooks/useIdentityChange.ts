import { useEffect, useRef } from 'react';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { readLocalStorage, writeLocalStorage } from '@app/services';

const STICKY_OWNER_KEY = 'webatrice.stickyTabs.owner';

export function useIdentityChange(onChange: () => void): void {
  const serverName = useAppSelector(server.Selectors.getName);
  const userName = useAppSelector(server.Selectors.getUser)?.name;
  const identity = serverName && userName ? `${serverName}::${userName}` : null;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (identity == null) {
      return;
    }
    const previous = readLocalStorage(STICKY_OWNER_KEY);
    if (previous && previous !== identity) {
      onChangeRef.current();
    }
    writeLocalStorage(STICKY_OWNER_KEY, identity);
  }, [identity]);
}
