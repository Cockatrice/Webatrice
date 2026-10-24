import { isFieldSet } from '@bufbuild/protobuf';
import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { Event_SetCardAttrSchema } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { attrOpKey, consumeOptimistic } from './optimistic';
import { buildTokenCard, cardAttachFields, cardAttrFields } from './game.reducer.helpers';
import {
  formatCardAttached,
  formatCardAttrChanged,
  formatCardAttrChangedBulk,
  formatCardDestroyed,
  formatCardFlipped,
  formatTokenCreated,
} from './messageLog';

export function registerCardsListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.cardAttrChanged,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId, attribute, attrValue } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) {
        return;
      }

      const fields = cardAttrFields(attribute, attrValue);

      if (!isFieldSet(data, Event_SetCardAttrSchema.field.cardId)) {
        // Cockatrice bulk sentinel: server omits card_id when applying to every card in the zone.
        const zone = game.players[playerId]?.zones[zoneName];
        if (!zone) {
          return;
        }
        if (fields) {
          api.dispatch(Actions.cardFieldsUpdatedBulk({ gameId, playerId, zoneName, fields }));
        }
        const bulkMessage = formatCardAttrChangedBulk(game, playerId, data);
        if (bulkMessage) {
          api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message: bulkMessage }));
        }
        return;
      }

      const card = game.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!card) {
        return;
      }
      const cardName = card.name;

      if (fields) {
        // cardFieldsUpdated is idempotent (fresh clone-with, same
        // input = same output) so the optimistic pre-dispatch can be
        // re-applied here safely. Consume any pending marker so the
        // rollback map doesn't leak entries.
        consumeOptimistic(attrOpKey(playerId, cardId, attribute));
        api.dispatch(Actions.cardFieldsUpdated({ gameId, playerId, zoneName, cardId, fields }));
      }

      const message = formatCardAttrChanged(game, playerId, data, cardName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardAttached,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { startZone, cardId } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const card = game?.players[playerId]?.zones[startZone]?.byId[cardId];
      if (!game || !card) {
        return;
      }
      const sourceCardName = card.name;

      const fields = cardAttachFields(data);
      api.dispatch(Actions.cardFieldsUpdated({
        gameId, playerId, zoneName: startZone, cardId, fields,
      }));

      const message = formatCardAttached(game, playerId, data, sourceCardName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardDestroyed,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const zone = game?.players[playerId]?.zones[zoneName];
      if (!game || !zone) {
        return;
      }
      // Pre-mutation read for log. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      const destroyedName = zone.byId[cardId]?.name;
      api.dispatch(Actions.cardRemovedFromZone({ gameId, playerId, zoneName, cardId }));

      const message = formatCardDestroyed(game, playerId, destroyedName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.tokenCreated,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const zone = game?.players[playerId]?.zones[zoneName];
      if (!game || !zone) {
        return;
      }
      const newCard = buildTokenCard(data);
      api.dispatch(Actions.cardInsertedIntoZone({ gameId, playerId, zoneName, card: newCard }));

      const message = formatTokenCreated(game, playerId, data);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardFlipped,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId } = data;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const preCard = preGame?.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!preGame || !preCard) {
        return;
      }
      const previousName = preCard.name;
      const message = formatCardFlipped(preGame, playerId, data, previousName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });
}
