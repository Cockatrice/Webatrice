import { createContext, useContext, type ComponentType } from 'react';

export interface UserMenuSlotProps {
  userName: string;
  userLevel?: number;
  onClose: () => void;
}

const UserMenuSlotContext = createContext<ComponentType<UserMenuSlotProps> | null>(null);

export const UserMenuSlotProvider = UserMenuSlotContext.Provider;

export function useUserMenuSlot(): ComponentType<UserMenuSlotProps> | null {
  return useContext(UserMenuSlotContext);
}
