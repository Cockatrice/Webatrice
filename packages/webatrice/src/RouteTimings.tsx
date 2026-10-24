import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import { RouteEnum } from '@app/types';
import { markLoadTiming } from './utils/loadTimings';

export default function RouteTimings() {
  const { pathname, key } = useLocation();
  useEffect(() => {
    markLoadTiming('app-render');
    const route = Object.values(RouteEnum).find(pattern => matchPath(pattern, pathname)) ?? '/';
    markLoadTiming('route-ready', route, true);
  }, [pathname, key]);
  return null;
}
