import { act, screen, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { ServerInfo_CardSchema, ServerInfo_ZoneSchema } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';
import { Game } from '@app/features/game';

import { store, connectRaw } from '../../helpers/setup';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';
import {
  battlefieldEl,
  chooseMenuPath,
  dismissMenus,
  menuLabels,
  openContextMenu,
} from '../../../../src/features/game/__test-utils__/seatFixtures';

registerGameBoardHooks();

const COMMAND_ZONE = create(ServerInfo_ZoneSchema, {
  name: 'command',
  type: 1,
  withCoords: false,
  cardCount: 1,
  cardList: [create(ServerInfo_CardSchema, { id: 900, name: 'Kenrith' })],
});

function stateChanged(withZone: boolean) {
  act(() => {
    store.dispatch(games.Actions.gameStateChanged({
      gameId: 42,
      data: buildEventGameStateChanged([1, 2], 1, withZone ? { extraZonesByPlayer: { 1: [COMMAND_ZONE] } } : {}),
    }));
  });
}

describe('custom zones', () => {
  it('lists a server\'s custom zone in the player menu and views it', async () => {
    connectRaw();
    renderFeatureScreen(<Game />);
    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }) }));
    });
    stateChanged(true);
    await waitFor(() => expect(battlefieldEl(1)).toBeInTheDocument());

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Custom Zones', 'View custom zone \'command\'');

    expect(await screen.findByRole('heading', { name: /^command — P1/ })).toBeInTheDocument();
    expect(screen.getAllByTitle('Kenrith').length).toBeGreaterThan(0);

    stateChanged(false);
    await dismissMenus();
    expect(menuLabels(openContextMenu(battlefieldEl(1)))).not.toContain('Custom Zones');
  });
});
