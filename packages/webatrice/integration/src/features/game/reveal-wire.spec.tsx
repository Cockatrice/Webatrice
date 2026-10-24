import { isFieldSet } from '@bufbuild/protobuf';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { games } from '@cockatrice/datatrice';
import { Command_RevealCards_ext, Command_RevealCardsSchema } from '@cockatrice/sockatrice/generated';
import { GameCommands } from '@cockatrice/sockatrice';
import { Game } from '@app/features/game';
import { connectAndLogin, connectRaw, store } from '../../helpers/setup';
import { findLastGameCommand } from '../../helpers/command-capture';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';
import { testI18n } from '../../../../src/__test-utils__/renderWithProviders';

registerGameBoardHooks();

function localLibrary(): HTMLElement {
  return screen.getByRole('button', {
    name: testI18n.t('ZoneStack.pile', { zone: testI18n.t('ZoneStack.library'), count: 40 }),
  });
}

function revealLibraryTo(recipient: string) {
  act(() => {
    fireEvent.contextMenu(localLibrary(), { clientX: 10, clientY: 10 });
  });
  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: testI18n.t('ZoneMenu.revealLibrary') }));
  });
  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: recipient }));
  });
}

describe('Command_RevealCards wire shape', () => {
  const lastReveal = () => findLastGameCommand(Command_RevealCards_ext).value;

  it('puts an explicitly set -1 on the wire, which is why senders must omit it', () => {
    connectAndLogin();
    GameCommands.revealCards(1, { zoneName: 'hand', playerId: -1 });
    expect(isFieldSet(lastReveal(), Command_RevealCardsSchema.field.playerId)).toBe(true);
  });

  it('omits player_id when a reveal menu targets all players', async () => {
    connectRaw();
    renderFeatureScreen(<Game />);
    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }) }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1) }));
    });
    await waitFor(() => expect(localLibrary()).toHaveAttribute('data-pile-count', '40'));

    revealLibraryTo(testI18n.t('CardMenu.allPlayers'));
    const toAll = lastReveal();
    expect(toAll.zoneName).toBe('deck');
    expect(isFieldSet(toAll, Command_RevealCardsSchema.field.playerId)).toBe(false);

    revealLibraryTo('P2');
    const toOne = lastReveal();
    expect(isFieldSet(toOne, Command_RevealCardsSchema.field.playerId)).toBe(true);
    expect(toOne.playerId).toBe(2);
  });
});
