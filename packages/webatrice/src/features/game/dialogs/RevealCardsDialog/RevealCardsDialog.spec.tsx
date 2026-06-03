import { screen, fireEvent } from '@testing-library/react';
import { Enriched } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { renderWithProviders } from '../../../../__test-utils__';
import type { GameDialogs, RevealState } from '../../hooks/useGameDialogs';
import RevealCardsDialog from './RevealCardsDialog';

// Two seated players; the reveal-target list is folded from the store.
const PRELOADED_STATE = {
  games: {
    games: {
      1: makeGameEntry({
        localPlayerId: 1,
        players: {
          1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }) }),
          2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, userInfo: { name: 'Bob' } }) }),
        },
      }),
    },
  },
};

function makeRevealState(overrides: Partial<RevealState> = {}): RevealState {
  return {
    title: 'Reveal hand',
    zoneName: Enriched.ZoneName.HAND,
    zoneLabel: 'Hand',
    showCountInput: false,
    defaultCount: 1,
    onSubmit: () => undefined,
    ...overrides,
  };
}

// RevealCardsDialog self-sources revealState + closeReveal from
// GameDialogsContext and self-gates (revealState null = closed).
function render(dialogs: Partial<GameDialogs> = {}) {
  return renderWithProviders(<RevealCardsDialog />, {
    preloadedState: PRELOADED_STATE,
    gameDialogs: { revealState: makeRevealState(), ...dialogs },
  });
}

describe('RevealCardsDialog', () => {
  it('does not render when there is no active reveal request', () => {
    render({ revealState: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defaults to All players and reports -1 + topCards=-1 for a zone-wide reveal', () => {
    const onSubmit = vi.fn();
    render({ revealState: makeRevealState({ onSubmit }) });

    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

    expect(onSubmit).toHaveBeenCalledWith({ targetPlayerId: -1, topCards: -1 });
  });

  it('emits the selected target playerId', () => {
    const onSubmit = vi.fn();
    render({ revealState: makeRevealState({ onSubmit }) });

    // MUI Select opens a popover; clicking the role=button for the Select.
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Bob' }));
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

    expect(onSubmit).toHaveBeenCalledWith({ targetPlayerId: 2, topCards: -1 });
  });

  it('falls back to a playerId-based name when a target has no userInfo name', () => {
    renderWithProviders(<RevealCardsDialog />, {
      preloadedState: {
        games: {
          games: {
            1: makeGameEntry({
              localPlayerId: 1,
              players: {
                1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }),
                7: makePlayerEntry({ properties: makePlayerProperties({ playerId: 7 }) }),
              },
            }),
          },
        },
      },
      gameDialogs: { revealState: makeRevealState() },
    });

    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'p7' })).toBeInTheDocument();
  });

  it('validates the count input when showCountInput is true', () => {
    const onSubmit = vi.fn();
    render({
      revealState: makeRevealState({
        title: 'Reveal top N',
        zoneLabel: 'Library',
        showCountInput: true,
        defaultCount: 3,
        onSubmit,
      }),
    });

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

    expect(onSubmit).toHaveBeenCalledWith({ targetPlayerId: -1, topCards: 5 });
  });

  it('rejects a non-positive count', () => {
    const onSubmit = vi.fn();
    render({
      revealState: makeRevealState({
        title: 'Reveal top N',
        zoneLabel: 'Library',
        showCountInput: true,
        onSubmit,
      }),
    });

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a positive integer/i)).toBeInTheDocument();
  });

  it('calls closeReveal when Cancel is clicked', () => {
    const closeReveal = vi.fn();
    render({ closeReveal });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(closeReveal).toHaveBeenCalled();
  });
});
