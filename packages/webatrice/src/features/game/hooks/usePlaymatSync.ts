import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { games, server, ServerCapability } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { getPlaymatSettings, settingsStore } from '@app/hooks';
import type { RootState } from '@app/store';
import { resolvePlaymat, sameCollectionSettings, samePlaymat } from '../utils/resolvePlaymat';
import { getPlaymatSyncState, prunePlaymatSyncState } from './playmatSyncState';

type PropertiesEvent = ReturnType<typeof games.Actions.playerPropertiesChanged>['payload'];

export function usePlaymatSync(): void {
  const store = useStore<RootState>();
  const webClient = useWebClient();
  useEffect(() => {
    let lastAction = store.getState().action?.count;
    const syncGames = () => {
      const state = store.getState();
      const action = state.action;
      const selected = action?.count !== lastAction && action?.type === games.Actions.playerPropertiesChanged.type
        ? action.payload as PropertiesEvent : undefined;
      lastAction = action?.count;
      const liveGames = Object.entries(games.Selectors.getGames(state)).filter(([, game]) => !game.replay);
      prunePlaymatSyncState(liveGames.map(([id]) => Number(id)));
      if (!server.Selectors.supports(state, ServerCapability.PLAYMATS)) {
        return;
      }
      const settings = getPlaymatSettings();
      for (const [id, game] of liveGames) {
        if (game.spectator) {
          continue;
        }
        const gameId = Number(id);
        const local = game.players[game.localPlayerId];
        if (!local) {
          continue;
        }
        const event = selected?.isDeckSelect && selected.gameId === gameId && selected.playerId === game.localPlayerId
          ? selected : undefined;
        const sync = getPlaymatSyncState(gameId);
        if (sync.wasStarted && !game.started) {
          sync.rotation++;
        }
        sync.wasStarted = game.started;
        const ready = local.properties.readyStart;
        const readied = ready && !sync.wasReady;
        sync.wasReady = ready;
        const received = event ? games.playmatFromParams(event.properties.playmatParams)
          : games.Selectors.getPlayerPlaymat(state, gameId, game.localPlayerId);
        const announced = received ? { ...received, cardProviderId: received.cardProviderId ?? '' } : null;
        const deckHash = event ? event.properties.deckHash : local.properties.deckHash;
        const initialDeck = !sync.deckHash && !!deckHash;
        if (event || initialDeck) {
          sync.deckHash = deckHash;
          sync.deckPlaymat = announced;
        }
        if (!sync.deckHash || !settingsStore.peek()) {
          continue;
        }
        const settingsChanged = !sameCollectionSettings(sync.settings, settings);
        if (!event && !initialDeck && !settingsChanged && !readied) {
          continue;
        }
        sync.settings = settings;
        const resolved = resolvePlaymat(sync.deckPlaymat, settings, sync.rotation, sync.lastResolved);
        sync.lastResolved = resolved;
        sync.lastSent = resolved;
        if (samePlaymat(resolved, announced)) {
          continue;
        }
        webClient.request.game.setPlaymat(gameId, {
          playmatParams: resolved
            ? { cardName: resolved.cardName, cardProviderId: resolved.cardProviderId, ...resolved.params }
            : { cardName: '' },
        });
      }
    };
    const unsubscribeGames = store.subscribe(syncGames);
    const unsubscribeSettings = settingsStore.subscribe(syncGames);
    syncGames();
    return () => {
      unsubscribeGames(); unsubscribeSettings();
    };
  }, [store, webClient]);
}
