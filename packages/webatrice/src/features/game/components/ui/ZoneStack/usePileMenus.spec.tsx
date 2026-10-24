import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import { testI18n } from '../../../../../__test-utils__/renderWithProviders';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../../../hooks/dialogs/gameDialogs.types';
import { GameDialogsProvider } from '../GameDialogsContext';
import type { PlayerCardViewModel, PlayerZoneCommands } from '../PlayerBoard/playerBoard.types';
import { usePileMenus, type UsePileMenusArgs } from './usePileMenus';

const pile = (...ids: number[]): PlayerCardViewModel[] => ids.map((id) => ({ id: String(id), name: `Card ${id}`, scryfallId: '' }));

type Item = Extract<ContextMenuItem, { label: string }>;
const labels = (items: ContextMenuItem[]) => items.map((i) => ('divider' in i ? '---' : i.label));
const find = (items: ContextMenuItem[], label: string) => items.find((i): i is Item => 'label' in i && i.label === label)!;

function setup(args: Partial<UsePileMenusArgs> = {}) {
  const openZoneView = vi.fn();
  const zoneCommands = { moveCards: vi.fn(), reveal: vi.fn() } as unknown as PlayerZoneCommands;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={testI18n}>
      <GameDialogsProvider value={{ ...NOOP_GAME_DIALOGS_ACTIONS, openZoneView } as unknown as GameDialogs}>{children}</GameDialogsProvider>
    </I18nextProvider>
  );
  const { result } = renderHook(() => usePileMenus({
    seatId: 1,
    revealTargets: [{ playerId: 2, name: 'Opp' }],
    graveDisplayList: pile(40, 41),
    exileDisplayList: pile(42),
    displayedGraveyardCount: 2,
    displayedExileCount: 1,
    menuShortcut: () => ({ shortcut: '', keyShortcuts: '' }),
    zoneCommands,
    ...args,
  }), { wrapper });
  return { menus: result.current, openZoneView, zoneCommands };
}

describe('usePileMenus', () => {
  it('builds desktop GraveyardMenu and RfgMenu for the owner', () => {
    const { menus } = setup();
    expect(labels(menus.graveMenuItemsSelf)).toEqual(['View graveyard', 'Reveal random card to...', '---', 'Move graveyard to...']);
    expect(labels(find(menus.graveMenuItemsSelf, 'Move graveyard to...').submenu!))
      .toEqual(['Top of library', 'Bottom of library', '---', 'Hand', '---', 'Exile']);
    expect(labels(menus.exileMenuItemsSelf)).toEqual(['View exile', '---', 'Move exile to...']);
    expect(labels(find(menus.exileMenuItemsSelf, 'Move exile to...').submenu!))
      .toEqual(['Top of library', 'Bottom of library', '---', 'Hand', '---', 'Graveyard']);
  });

  it('moves a whole pile in one command, bottom to top', () => {
    const { menus, zoneCommands } = setup();
    find(find(menus.graveMenuItemsSelf, 'Move graveyard to...').submenu!, 'Bottom of library').onClick!();
    expect(zoneCommands.moveCards).toHaveBeenCalledWith(ZoneName.GRAVE, [40, 41], { zone: ZoneName.DECK, index: 'end' });
  });

  it('reveals a random graveyard card to everyone or one player', () => {
    const { menus, zoneCommands } = setup();
    const submenu = find(menus.graveMenuItemsSelf, 'Reveal random card to...').submenu!;
    expect(labels(submenu)).toEqual(['All players', '---', 'Opp']);
    find(submenu, 'All players').onClick!();
    find(submenu, 'Opp').onClick!();
    expect(vi.mocked(zoneCommands.reveal).mock.calls).toEqual([
      [ZoneName.GRAVE, 'all', 'random'],
      [ZoneName.GRAVE, 2, 'random'],
    ]);
  });

  it('gives another viewer only the views, disabled for an empty pile', () => {
    const { menus, openZoneView } = setup({ graveDisplayList: [], displayedGraveyardCount: 0 });
    expect(menus.graveMenuItemsOpponent).toEqual([expect.objectContaining({ label: 'View graveyard', disabled: true })]);
    find(menus.exileMenuItemsOpponent, 'View exile').onClick!();
    expect(openZoneView).toHaveBeenCalledWith({ playerId: 1, zoneName: ZoneName.EXILE });
    expect(find(menus.graveMenuItemsSelf, 'Move graveyard to...').disabled).toBe(true);
  });
});
