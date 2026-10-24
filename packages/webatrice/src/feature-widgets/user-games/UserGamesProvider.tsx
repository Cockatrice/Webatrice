import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { UserMenuSlotProvider, useUserMenuSlot, type UserMenuSlotProps } from '@app/components';
import { DialogReturnFocusContext, closestList } from '@app/hooks';

import UserGamesDialog from './UserGamesDialog';
import UserGamesMenuItem from './UserGamesMenuItem';
import { UserGamesContext, type UserGamesApi } from './useUserGames';

export const UserGamesProvider = ({ children }: { children: ReactNode }) => {
  const [userName, setUserName] = useState<string | null>(null);
  const api = useMemo<UserGamesApi>(() => ({ open: setUserName }), []);
  const close = useCallback(() => setUserName(null), []);

  const OuterSlot = useUserMenuSlot();
  const Slot = useMemo(() => {
    const UserMenuEntries = (props: UserMenuSlotProps) => (
      <>
        <UserGamesMenuItem {...props} />
        {OuterSlot && <OuterSlot {...props} />}
      </>
    );
    return UserMenuEntries;
  }, [OuterSlot]);

  return (
    <UserGamesContext.Provider value={api}>
      <UserMenuSlotProvider value={Slot}>
        {children}
      </UserMenuSlotProvider>
      <DialogReturnFocusContext.Provider value={closestList}>
        {userName && <UserGamesDialog key={userName} userName={userName} onClose={close} />}
      </DialogReturnFocusContext.Provider>
    </UserGamesContext.Provider>
  );
};
