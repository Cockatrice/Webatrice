import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { persistLastRoute } from '@app/services';

export function usePersistLastRoute(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    persistLastRoute(pathname);
  }, [pathname]);
}
