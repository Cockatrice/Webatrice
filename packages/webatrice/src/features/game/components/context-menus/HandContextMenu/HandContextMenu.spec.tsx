import { ZoneName } from '@cockatrice/sockatrice';
import { screen, fireEvent } from '@testing-library/react';

import { createMockWebClient, makeStoreState, renderWithProviders } from '../../../../../__test-utils__';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import type { GameDialogs } from '../../../hooks/useGameDialogs';
import HandContextMenu from './HandContextMenu';

// HandContextMenu now self-sources: menu state + action handlers come from
// GameDialogsContext, and handSize is derived from the local player's HAND zone.
function render(opts: { handSize?: number; dialogs?: Partial<GameDialogs> } = {}) {
  const handSize = opts.handSize ?? 7;
  const hand = makeZoneEntry({ name: ZoneName.HAND, cardCount: handSize });
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    zones: { [ZoneName.HAND]: hand },
  });
  const preloadedState = makeStoreState({
    games: { games: { 1: makeGameEntry({ localPlayerId: 1, players: { 1: player } }) } },
  });
  const webClient = createMockWebClient();
  return {
    ...renderWithProviders(<HandContextMenu />, {
      preloadedState,
      webClient,
      // handMenu non-null = open.
      gameDialogs: { handMenu: { top: 10, left: 10 }, ...opts.dialogs },
    }),
    webClient,
  };
}

describe('HandContextMenu', () => {
  it('fires the choose-mulligan request and closes when the choose-size item is clicked', () => {
    const handleRequestChooseMulligan = vi.fn();
    const closeHandMenu = vi.fn();
    render({ dialogs: { handleRequestChooseMulligan, closeHandMenu } });

    fireEvent.click(screen.getByRole('menuitem', { name: /choose size/i }));

    expect(handleRequestChooseMulligan).toHaveBeenCalled();
    expect(closeHandMenu).toHaveBeenCalled();
  });

  it('dispatches mulligan(number=handSize) on the same-size item', () => {
    const { webClient } = render({ handSize: 7 });

    fireEvent.click(screen.getByRole('menuitem', { name: /same size/i }));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 7 });
  });

  it('dispatches mulligan(number=handSize-1) on the size−1 item', () => {
    const { webClient } = render({ handSize: 5 });

    fireEvent.click(screen.getByRole('menuitem', { name: /size − 1/i }));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 4 });
  });

  it('floors size−1 at 1, matching desktop actMulliganMinusOne', () => {
    const { webClient } = render({ handSize: 1 });

    fireEvent.click(screen.getByRole('menuitem', { name: /size − 1/i }));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('disables same-size when handSize is 0', () => {
    render({ handSize: 0 });

    expect(screen.getByRole('menuitem', { name: /same size/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('fires the reveal-hand request and closes on reveal-hand item', () => {
    const handleRequestRevealHand = vi.fn();
    const closeHandMenu = vi.fn();
    render({ dialogs: { handleRequestRevealHand, closeHandMenu } });

    fireEvent.click(screen.getByRole('menuitem', { name: /reveal hand/i }));

    expect(handleRequestRevealHand).toHaveBeenCalled();
    expect(closeHandMenu).toHaveBeenCalled();
  });
});
