import { act, fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import { allActionIds, defaults } from '../defaults';
import ShortcutsTab from './ShortcutsTab';
import shortcutsText from './ShortcutsTab.i18n.json';

describe('ShortcutsTab', () => {
  it('lists the game groups in desktop order, then the other scopes', () => {
    renderWithProviders(<ShortcutsTab />);
    const headers = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded'));
    expect(headers.map((b) => b.textContent?.replace(/\d+$/, ''))).toEqual([
      'ShortcutsTab.group.gameCardCounters',
      'ShortcutsTab.group.gamePlayerCounters',
      'ShortcutsTab.group.gamePowerToughness',
      'ShortcutsTab.group.gamePhases',
      'ShortcutsTab.group.gamePlayingArea',
      'ShortcutsTab.group.gameMoveSelected',
      'ShortcutsTab.group.gameView',
      'ShortcutsTab.group.gameMoveTop',
      'ShortcutsTab.group.gameMoveBottom',
      'ShortcutsTab.group.gameplay',
      'ShortcutsTab.group.gameDrawing',
      'ShortcutsTab.group.gameHand',
      'ShortcutsTab.group.game',
      'ShortcutsTab.group.deckEditor',
      'ShortcutsTab.group.room',
      'ShortcutsTab.group.replays',
    ]);
  });

  it('shows each new action under its desktop group, unbound ones as having no binding', () => {
    renderWithProviders(<ShortcutsTab />);
    const action = shortcutsText.ShortcutsTab.action;
    const section = (group: string) =>
      screen.getByRole('button', { name: new RegExp(`ShortcutsTab\\.group\\.${group}\\d`) }).closest('section')!;
    expect(within(section('gamePlayingArea')).getByText(action['game.tapCard'])).toBeInTheDocument();
    expect(within(section('gameMoveSelected')).getByText(action['game.moveSelectedToExile'])).toBeInTheDocument();
    expect(within(section('gameView')).getByText(action['game.viewHand'])).toBeInTheDocument();
    expect(within(section('gameHand')).getByText(action['game.revealHandToAll'])).toBeInTheDocument();
    expect(within(section('gameMoveTop')).getByText(action['game.moveTopToExile'])).toBeInTheDocument();
    expect(within(section('gameMoveBottom')).getByText(action['game.drawBottomCard'])).toBeInTheDocument();
    expect(within(section('gameplay')).getByText(action['game.shuffleTopCards'])).toBeInTheDocument();
    expect(within(section('gameCardCounters')).getByText(action['game.addCounterD'])).toBeInTheDocument();
    expect(within(section('gamePlayerCounters')).getByText(action['game.incManaCounterW'])).toBeInTheDocument();
    expect(within(section('gamePowerToughness')).getByText(action['game.flowP'])).toBeInTheDocument();
    expect(within(section('gamePhases')).getByText(action['game.setPhase10'])).toBeInTheDocument();
    const tapRow = within(section('gamePlayingArea')).getByText(action['game.tapCard']).closest('div')!.parentElement!;
    expect(within(tapRow).getByText('ShortcutsTab.noBinding')).toBeInTheDocument();
  });

  it('collapses a group from its focusable header button, and every row edits from a focusable button', () => {
    renderWithProviders(<ShortcutsTab />);
    const header = screen.getByRole('button', { name: /ShortcutsTab\.group\.gameHand\d/ });
    expect(header.tagName).toBe('BUTTON');
    act(() => header.focus());
    expect(header).toHaveFocus();
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(shortcutsText.ShortcutsTab.action['game.sortHandByName'])).not.toBeInTheDocument();
    const edits = screen.getAllByRole('button', { name: 'ShortcutsTab.editAction' });
    const visibleActionCount = allActionIds.filter((id) => defaults[id].group !== 'gameHand').length;
    expect(edits).toHaveLength(visibleActionCount);
    expect(edits.filter((b) => b.tagName !== 'BUTTON' || b.tabIndex < 0)).toEqual([]);
  });
});
