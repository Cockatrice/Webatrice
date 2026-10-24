import { createContext, useContext, type ReactNode } from 'react';

const BoardTrayHostContext = createContext<HTMLElement | null>(null);

export function BoardTrayHostProvider({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  return <BoardTrayHostContext.Provider value={host}>{children}</BoardTrayHostContext.Provider>;
}

export function useBoardTrayHost(): HTMLElement | null {
  return useContext(BoardTrayHostContext);
}
