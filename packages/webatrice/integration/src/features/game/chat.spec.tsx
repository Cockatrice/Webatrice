import { act, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Command_GameSay_ext } from '@cockatrice/sockatrice/generated';
import { store, connectRaw } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { findLastGameCommand } from '../../helpers/command-capture';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

describe('Game chat', () => {
  it('sends a game_say command through the socket when a chat message is submitted', async () => {
    // Establish a real mock socket so the outbound CommandContainer is captured.
    connectRaw();

    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      // buildEventGameStateChanged sets gameStarted: true, suppressing the
      // deck-select dialog which would otherwise block focus/interaction.
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('ChatLog.inputLabel')).not.toBeDisabled();
    });

    const input = screen.getByLabelText('ChatLog.inputLabel') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'gl hf' } });
    fireEvent.submit(input.closest('form')!);

    const captured = findLastGameCommand(Command_GameSay_ext);
    expect(captured.value.message).toBe('gl hf');
    expect(captured.gameId).toBe(42);
  });

  it('completes @mentions from the game\'s players and sends the completed text', async () => {
    connectRaw();

    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('ChatLog.inputLabel')).not.toBeDisabled();
    });

    const input = screen.getByRole('combobox', { name: 'ChatLog.inputLabel' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'gg @p' } });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['@P1', '@P2']);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('gg @P2 ');

    fireEvent.submit(input.closest('form')!);

    expect(findLastGameCommand(Command_GameSay_ext).value.message).toBe('gg @P2');
  });
});
