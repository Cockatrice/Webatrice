import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';

import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import { connectedState, makeStoreState, makeUser, renderWithProviders } from '../../../../__test-utils__';
import { GameIdProvider } from '../ui/GameIdContext';
import type { DockTab } from '../../hooks/useDockState';
import GameDock from './GameDock';

vi.mock('../GameInviteControls/GameInviteControls', () => ({ default: () => null }));
vi.mock('../GameMenu/GameMenu', () => ({ default: () => null }));

function buildState() {
  const seat = (playerId: number, name: string) =>
    makePlayerEntry({ properties: makePlayerProperties({ playerId, userInfo: makeUser({ name }) }) });
  return makeStoreState({
    ...connectedState,
    games: { games: { 1: makeGameEntry({ localPlayerId: 1, started: true, players: { 1: seat(1, 'Alice'), 2: seat(2, 'Bob') } }) } },
  });
}

function Harness({ initialTab = 'log', initialCollapsed = false }: { initialTab?: DockTab; initialCollapsed?: boolean }) {
  const [tab, setTab] = useState<DockTab>(initialTab);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  return (
    <ShortcutProvider>
      <GameIdProvider value={1}>
        <GameDock
          collapsed={collapsed}
          tab={tab}
          onCollapse={setCollapsed}
          onSelectTab={(next) => {
            setTab(next);
            setCollapsed(false);
          }}
        />
      </GameIdProvider>
    </ShortcutProvider>
  );
}

describe('GameDock chat', () => {
  it('keeps an unsent draft across tab switches and a collapse', () => {
    renderWithProviders(<Harness />, { preloadedState: buildState(), route: '/game/1' });
    const input = () => screen.getByLabelText('ChatLog.inputLabel') as HTMLInputElement;
    fireEvent.change(input(), { target: { value: 'hold on' } });
    fireEvent.click(screen.getByRole('tab', { name: /^Players/ }));
    expect(input()).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse the dock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand the dock' }));
    fireEvent.click(screen.getByRole('tab', { name: /^Chat/ }));
    expect(input()).toBeVisible();
    expect(input().value).toBe('hold on');
  });

  it('Shift+Enter opens the Chat & log tab from a collapsed dock and focuses the input', () => {
    renderWithProviders(<Harness initialTab="players" initialCollapsed />, { preloadedState: buildState(), route: '/game/1' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', shiftKey: true, cancelable: true, bubbles: true }));
    });
    expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('ChatLog.inputLabel')).toHaveFocus();
  });
});
