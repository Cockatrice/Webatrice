import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import { testI18n } from '../../../../../__test-utils__/renderWithProviders';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../../../hooks/dialogs/gameDialogs.types';
import { GameDialogsProvider } from '../GameDialogsContext';
import type { HandZoneViewModel, PlayerZoneCommands } from '../PlayerBoard/playerBoard.types';
import { useHandMenuItems, type UseHandMenuItemsArgs } from './useHandMenuItems';

type Item = Extract<ContextMenuItem, { label: string }>;
const labels = (items: ContextMenuItem[]) => items.map((i) => ('divider' in i ? '---' : i.label));
const find = (items: ContextMenuItem[], ...path: string[]): Item => {
  let item = items.find((i): i is Item => 'label' in i && i.label === path[0])!;
  for (const label of path.slice(1)) {
    item = item.submenu!.find((i): i is Item => 'label' in i && i.label === label)!;
  }
  return item;
};

const hand = (ids: number[], cardCount = ids.length): HandZoneViewModel => ({
  cards: ids.map((id) => ({ id: String(id), name: `Card ${id}`, scryfallId: '' })),
  cardCount,
});

function setup(args: Partial<UseHandMenuItemsArgs> = {}) {
  const dialogs = {
    ...NOOP_GAME_DIALOGS_ACTIONS,
    openZoneView: vi.fn(),
    handleRequestSortHandBy: vi.fn(),
    handleRequestChooseMulligan: vi.fn(),
  };
  const zoneCommands = { moveCards: vi.fn(), reveal: vi.fn(), mulligan: vi.fn() } as unknown as PlayerZoneCommands;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={testI18n}>
      <GameDialogsProvider value={dialogs as unknown as GameDialogs}>{children}</GameDialogsProvider>
    </I18nextProvider>
  );
  const { result } = renderHook(() => useHandMenuItems({
    seatId: 1,
    isSelf: true,
    hand: hand([30, 31, 32]),
    revealTargets: [{ playerId: 2, name: 'Opp' }],
    menuShortcut: () => ({ shortcut: '', keyShortcuts: '' }),
    zoneCommands,
    ...args,
  }), { wrapper });
  return { ...result.current, dialogs, zoneCommands };
}

describe('useHandMenuItems', () => {
  it('follows desktop HandMenu', () => {
    expect(labels(setup().handMenuItems)).toEqual([
      'View hand', 'Sort hand by...', 'Reveal hand to...', 'Reveal random card to...', '---',
      'Take mulligan (Choose hand size)', 'Take mulligan (Same hand size)', 'Take mulligan (Hand size - 1)', '---',
      'Move hand to...',
    ]);
  });

  it('counts the hand from the server count, which an opponent seat also has', () => {
    const { handSize, handMenuItems } = setup({ isSelf: false, hand: hand([], 5) });
    expect(handSize).toBe(5);
    expect(find(handMenuItems, 'View hand').disabled).toBe(true);
    expect(find(handMenuItems, 'Sort hand by...', 'Name').disabled).toBe(true);
  });

  it('lists "All players" in the reveal submenus even when playing alone', () => {
    const { handMenuItems } = setup({ revealTargets: [] });
    expect(labels(find(handMenuItems, 'Reveal hand to...').submenu!)).toEqual(['All players', '---']);
    expect(labels(find(handMenuItems, 'Reveal random card to...').submenu!)).toEqual(['All players', '---']);
  });

  it('views, sorts, reveals and mulligans', () => {
    const { handMenuItems, dialogs, zoneCommands } = setup();
    find(handMenuItems, 'View hand').onClick!();
    expect(dialogs.openZoneView).toHaveBeenCalledWith({ playerId: 1, zoneName: ZoneName.HAND });
    find(handMenuItems, 'Sort hand by...', 'Mana Value').onClick!();
    expect(dialogs.handleRequestSortHandBy).toHaveBeenCalledWith('manacost');
    find(handMenuItems, 'Reveal hand to...', 'All players').onClick!();
    find(handMenuItems, 'Reveal random card to...', 'Opp').onClick!();
    expect(vi.mocked(zoneCommands.reveal).mock.calls).toEqual([
      [ZoneName.HAND, 'all'],
      [ZoneName.HAND, 2, 'random'],
    ]);
    find(handMenuItems, 'Take mulligan (Hand size - 1)').onClick!();
    expect(zoneCommands.mulligan).toHaveBeenCalledWith(2);
    find(handMenuItems, 'Take mulligan (Choose hand size)').onClick!();
    expect(dialogs.handleRequestChooseMulligan).toHaveBeenCalled();
  });

  it('moves the whole hand in one command', () => {
    const { handMenuItems, zoneCommands } = setup();
    find(handMenuItems, 'Move hand to...', 'Bottom of library').onClick!();
    expect(zoneCommands.moveCards).toHaveBeenCalledWith(ZoneName.HAND, [30, 31, 32], { zone: ZoneName.DECK, index: 'end' });
  });
});
