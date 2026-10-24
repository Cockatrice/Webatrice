import { useCallback, useMemo } from 'react';

import { games } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';

import {
  applySideboardPlan,
  getSideboardPlan,
  otherDeckZone,
  parseDeckView,
  type DeckView,
  type DeckZone,
} from './deckViewModel';
import { useLobbyDeckState } from './LobbyDeckStateProvider';

export interface LobbyDeckView {
  deckLoaded: boolean;
  view: DeckView | null;
  ready: boolean;
  sideboardLocked: boolean;
  editable: boolean;
  moveCard: (zone: DeckZone, cardName: string) => void;
  toggleSideboardLock: () => void;
  toggleReady: () => void;
  unloadDeck: () => void;
}

export function useLobbyDeckView(gameId: number): LobbyDeckView {
  const webClient = useWebClient();
  const localPlayer = useAppSelector((state) => games.Selectors.getLocalPlayer(state, gameId));
  const localPlayerId = localPlayer?.properties.playerId;
  const deckList = localPlayer?.deckList ?? '';
  const ready = localPlayer?.properties.readyStart ?? false;
  const sideboardLocked = localPlayer?.properties.sideboardLocked ?? true;

  const parsed = useMemo(() => parseDeckView(deckList), [deckList]);

  const { state, setState } = useLobbyDeckState(gameId, localPlayerId, deckList);

  const plan = useMemo(() => {
    if (!parsed) {
      return [];
    }
    return state?.plan ?? parsed.currentPlan;
  }, [parsed, state]);

  const view = useMemo(() => (parsed ? applySideboardPlan(parsed.view, plan) : null), [parsed, plan]);
  const editable = !!view && !ready && !sideboardLocked;

  const moveCard = useCallback(
    (zone: DeckZone, cardName: string) => {
      if (!view || !editable) {
        return;
      }
      const moved = applySideboardPlan(view, [{ cardName, startZone: zone, targetZone: otherDeckZone(zone) }]);
      const moveList = getSideboardPlan(moved);
      setState({ plan: moveList });
      webClient.request.game.setSideboardPlan(gameId, { moveList });
    },
    [view, editable, setState, gameId, webClient],
  );

  const toggleSideboardLock = useCallback(() => {
    if (ready) {
      return;
    }
    webClient.request.game.setSideboardLock(gameId, { locked: !sideboardLocked });
  }, [ready, sideboardLocked, gameId, webClient]);

  const toggleReady = useCallback(() => {
    webClient.request.game.readyStart(gameId, { ready: !ready });
  }, [ready, gameId, webClient]);

  const unloadDeck = useCallback(() => {
    setState({ unloaded: true });
    webClient.request.game.readyStart(gameId, { ready: false });
  }, [setState, gameId, webClient]);

  return {
    deckLoaded: !!view && !state?.unloaded,
    view,
    ready,
    sideboardLocked,
    editable,
    moveCard,
    toggleSideboardLock,
    toggleReady,
    unloadDeck,
  };
}
