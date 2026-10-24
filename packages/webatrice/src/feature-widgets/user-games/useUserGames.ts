import { createContext, useContext } from 'react';

export interface UserGamesApi {
  open: (userName: string) => void;
}

export const UserGamesContext = createContext<UserGamesApi | null>(null);

export function useUserGames(): UserGamesApi | null {
  return useContext(UserGamesContext);
}
