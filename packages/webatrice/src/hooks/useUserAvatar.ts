import { useCallback, useContext, useSyncExternalStore } from 'react';

import { UserAvatarContext } from '@app/services';

export interface UserAvatar {
  src: string | null;
  ref: (element: Element | null) => (() => void) | undefined;
}

const noSubscribe = () => () => {};
const noSrc = () => null;

export function useUserAvatar(name: string | null | undefined): UserAvatar {
  const service = useContext(UserAvatarContext);
  const active = service && name ? service : null;
  const src = useSyncExternalStore(
    active ? active.subscribe : noSubscribe,
    active && name ? () => active.getSrc(name) : noSrc,
  );
  const ref = useCallback((element: Element | null) => (
    element && active && name ? active.observe(element, name) : undefined
  ), [active, name]);
  return { src, ref };
}
