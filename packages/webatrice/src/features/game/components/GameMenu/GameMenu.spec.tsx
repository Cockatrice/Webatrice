import { fireEvent, screen, within } from '@testing-library/react';
import { Phase } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../../../__test-utils__';
import GameMenu from './GameMenu';

function renderMenu({
  activePlayerId = 1, spectator = false, conceded = false, judge = false, activePhase = Phase.Upkeep as number,
} = {}) {
  const webClient = createMockWebClient();
  const onRotateView = vi.fn();
  const game = makeGameEntry({
    started: true,
    activePhase,
    localPlayerId: 1,
    activePlayerId,
    spectator,
    judge,
    players: { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, conceded }) }) },
  });
  renderWithProviders(<GameMenu className="" />, {
    webClient,
    preloadedState: { games: { games: { 1: game }, pings: {} } },
    gameDialogActions: { onRotateView },
  });
  fireEvent.click(screen.getByRole('button', { name: /GameMenu.button/ }));
  const item = (id: string) => within(screen.getByRole('menu', { name: 'GameMenu.button' }))
    .getByRole('menuitem', { name: `GameMenu.item.${id}` });
  return { webClient, item, onRotateView };
}

const isDisabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';

describe('GameMenu', () => {
  it('lists the phase and turn actions in desktop order', () => {
    const { item } = renderMenu();
    const order = ['nextPhase', 'nextPhaseAction', 'nextTurn', 'reverseTurn', 'rotateViewCW', 'rotateViewCCW'].map(item);
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('lets a conceded judge reverse the turn order but not pass the turn', () => {
    const { webClient, item } = renderMenu({ judge: true, conceded: true });

    expect(isDisabled(item('nextTurn'))).toBe(true);
    expect(isDisabled(item('reverseTurn'))).toBe(false);
    fireEvent.click(item('reverseTurn'));
    expect(webClient.request.game.reverseTurn).toHaveBeenCalledWith(1);
  });

  it('sends one Command_ReverseTurn, without confirmation', () => {
    const { webClient, item } = renderMenu();

    fireEvent.click(item('reverseTurn'));

    expect(webClient.request.game.reverseTurn).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.reverseTurn).toHaveBeenCalledWith(1);
  });

  it('runs next phase with action: Upkeep sets Draw and draws a card', () => {
    const { webClient, item } = renderMenu({ activePhase: Phase.Upkeep });

    fireEvent.click(item('nextPhaseAction'));

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: Phase.Draw }, expect.anything());
    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('advances one phase and passes the turn', () => {
    const { webClient, item } = renderMenu({ activePhase: Phase.FirstMain });

    fireEvent.click(item('nextPhase'));
    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: Phase.BeginCombat }, expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /GameMenu.button/ }));
    fireEvent.click(item('nextTurn'));
    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1);
  });

  it('lets a participant off turn pass or reverse the turn, but not change the phase', () => {
    const { item } = renderMenu({ activePlayerId: 2 });

    expect(isDisabled(item('nextPhase'))).toBe(true);
    expect(isDisabled(item('nextPhaseAction'))).toBe(true);
    expect(isDisabled(item('nextTurn'))).toBe(false);
    expect(isDisabled(item('reverseTurn'))).toBe(false);
  });

  it.each([
    ['a spectator', { spectator: true, activePlayerId: 2 }],
    ['a conceded player', { conceded: true, activePlayerId: 2 }],
  ])('disables reverse turn for %s', (_label, opts) => {
    const { webClient, item } = renderMenu(opts);

    expect(isDisabled(item('reverseTurn'))).toBe(true);
    fireEvent.click(item('reverseTurn'));
    expect(webClient.request.game.reverseTurn).not.toHaveBeenCalled();
  });

  it('rotates a spectator\'s view either way without a request', () => {
    const { webClient, item, onRotateView } = renderMenu({ spectator: true, activePlayerId: 2 });

    expect(isDisabled(item('rotateViewCW'))).toBe(false);
    fireEvent.click(item('rotateViewCW'));
    fireEvent.click(screen.getByRole('button', { name: /GameMenu.button/ }));
    fireEvent.click(item('rotateViewCCW'));

    expect(onRotateView.mock.calls).toEqual([[-1], [1]]);
    expect(Object.values(webClient.request.game).some((fn) => vi.mocked(fn).mock.calls.length > 0)).toBe(false);
  });
});
