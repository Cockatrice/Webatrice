import { act, waitFor, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { Event_GameStateChangedSchema, ServerInfo_PlayerPropertiesSchema, ServerInfo_PlayerSchema, ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';
import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

describe('Game deck select', () => {
  it('auto-opens the DeckSelectDialog when a game is joined and not started', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: create(Event_GameStateChangedSchema, {
        gameStarted: false,
        activePlayerId: 1,
        activePhase: -1,
        playerList: [1, 2].map((pid) =>
          create(ServerInfo_PlayerSchema, {
            properties: create(ServerInfo_PlayerPropertiesSchema, {
              playerId: pid,
              userInfo: create(ServerInfo_UserSchema, { name: `P${pid}` }),
            }),
            deckList: '',
            zoneList: [],
            counterList: [],
            arrowList: [],
          }),
        ),
      }), }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('deck list')).toBeInTheDocument();
    });
  });
});
