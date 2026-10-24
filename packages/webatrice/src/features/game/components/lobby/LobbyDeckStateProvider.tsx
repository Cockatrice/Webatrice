import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from 'react-redux';

import { games } from '@cockatrice/datatrice';
import { useReduxEffect } from '@app/hooks';
import { useAppSelector, type RootState } from '@app/store';

import type { SideboardPlanMove } from './deckViewModel';

interface DeckState {
  gameId: number;
  playerId: number;
  deckList: string;
  plan?: SideboardPlanMove[];
  unloaded?: boolean;
}

interface LobbyDeckState {
  entries: Record<string, DeckState>;
  update: (gameId: number, playerId: number, deckList: string, change: Pick<DeckState, 'plan' | 'unloaded'>) => void;
}

const LobbyDeckContext = createContext<LobbyDeckState | null>(null);
const seatKey = (gameId: number, playerId: number) => `${gameId}:${playerId}`;

export function LobbyDeckStateProvider({ children }: { children: ReactNode }) {
  const store = useStore<RootState>();
  const activeGames = useAppSelector((state) => state.games.games);
  const [entries, setEntries] = useState<Record<string, DeckState>>({});
  const update = useCallback<LobbyDeckState['update']>((gameId, playerId, deckList, change) => {
    const key = seatKey(gameId, playerId);
    setEntries(previous => ({
      ...previous,
      [key]: {
        ...(previous[key]?.deckList === deckList ? previous[key] : {}),
        gameId, playerId, deckList, ...change,
      },
    }));
  }, []);

  useReduxEffect<{ gameId: number }>(({ payload }) => {
    const player = games.Selectors.getLocalPlayer(store.getState(), payload.gameId);
    if (player) {
      update(payload.gameId, player.properties.playerId, player.deckList ?? '', { plan: undefined, unloaded: false });
    }
  }, games.Types.DECK_SELECTED, [store, update]);

  useReduxEffect<{ gameId: number; playerId: number; properties: { sideboardLocked?: boolean } }>(({ payload }) => {
    const player = games.Selectors.getLocalPlayer(store.getState(), payload.gameId);
    if (player?.properties.playerId === payload.playerId && payload.properties.sideboardLocked) {
      update(payload.gameId, payload.playerId, player.deckList ?? '', { plan: [] });
    }
  }, games.Types.PLAYER_PROPERTIES_CHANGED, [store, update]);

  useReduxEffect<{ gameId: number }>(({ payload }) => {
    setEntries(previous => Object.fromEntries(Object.entries(previous).filter(([, entry]) => entry.gameId !== payload.gameId)));
  }, games.Types.GAME_LEFT);

  useEffect(() => {
    setEntries(previous => {
      const retained = Object.entries(previous).filter(([, entry]) => {
        const player = activeGames[entry.gameId]?.players[entry.playerId];
        return player && (player.deckList ?? '') === entry.deckList;
      });
      return retained.length === Object.keys(previous).length ? previous : Object.fromEntries(retained);
    });
  }, [activeGames]);

  const value = useMemo(() => ({ entries, update }), [entries, update]);
  return <LobbyDeckContext.Provider value={value}>{children}</LobbyDeckContext.Provider>;
}

export function useLobbyDeckState(gameId: number, playerId: number | undefined, deckList: string) {
  const context = useContext(LobbyDeckContext);
  if (!context) {
    throw new Error('LobbyDeckStateProvider is required');
  }
  const { entries, update } = context;
  const entry = playerId === undefined ? undefined : entries[seatKey(gameId, playerId)];
  const state = entry?.deckList === deckList ? entry : undefined;
  const setState = useCallback((change: Pick<DeckState, 'plan' | 'unloaded'>) => {
    if (playerId !== undefined) {
      update(gameId, playerId, deckList, change);
    }
  }, [gameId, playerId, deckList, update]);
  return { state, setState };
}
