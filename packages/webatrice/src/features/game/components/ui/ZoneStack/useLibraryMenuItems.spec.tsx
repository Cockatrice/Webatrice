import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import { testI18n } from '../../../../../__test-utils__/renderWithProviders';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../../../hooks/dialogs/gameDialogs.types';
import { GameDialogsProvider } from '../GameDialogsContext';
import type { PlayerZoneCommands } from '../PlayerBoard/playerBoard.types';
import { useLibraryOps, type UseLibraryOpsArgs } from '../PlayerBoard/useLibraryOps';
import { useLibraryMenuItems, type UseLibraryMenuItemsArgs } from './useLibraryMenuItems';

type Item = Extract<ContextMenuItem, { label: string }>;
const labels = (items: ContextMenuItem[]) => items.map((i) => ('divider' in i ? '---' : i.label));
const find = (items: ContextMenuItem[], ...path: string[]): Item => {
  let item = items.find((i): i is Item => 'label' in i && i.label === path[0])!;
  for (const label of path.slice(1)) {
    item = item.submenu!.find((i): i is Item => 'label' in i && i.label === label)!;
  }
  return item;
};

type SetupArgs = Partial<Omit<UseLibraryMenuItemsArgs, 'libraryOps'>> & { openCountPrompt?: UseLibraryOpsArgs['openCountPrompt'] };

function setup(args: SetupArgs = {}) {
  const openZoneView = vi.fn();
  const zoneCommands = {
    moveCards: vi.fn(),
    reveal: vi.fn(),
    lendLibrary: vi.fn(),
    shuffleLibrary: vi.fn(),
    undoDraw: vi.fn(),
    setAlwaysRevealTopCard: vi.fn(),
    setAlwaysLookAtTopCard: vi.fn(),
  } as unknown as PlayerZoneCommands;
  const props = {
    seatId: 1,
    deckCount: 30,
    revealTargets: [{ playerId: 2, name: 'Opp' }],
    alwaysRevealTopCard: false,
    alwaysLookAtTopCard: true,
    draw: vi.fn(),
    openCountPrompt: vi.fn<UseLibraryOpsArgs['openCountPrompt']>(),
    openDrawCardsPrompt: vi.fn(),
    openViewLibraryCountPrompt: vi.fn(),
    openRevealTopCardsPrompt: vi.fn(),
    openMoveTopUntilDialog: vi.fn(),
    onOpenDeckInEditor: undefined,
    menuShortcut: () => ({ shortcut: '', keyShortcuts: '' }),
    zoneCommands,
    ...args,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={testI18n}>
      <GameDialogsProvider value={{ ...NOOP_GAME_DIALOGS_ACTIONS, openZoneView } as unknown as GameDialogs}>{children}</GameDialogsProvider>
    </I18nextProvider>
  );
  const { result } = renderHook(() => {
    const { openCountPrompt, ...menuProps } = props;
    const libraryOps = useLibraryOps({ deckCount: props.deckCount, openCountPrompt, zoneCommands });
    return useLibraryMenuItems({ ...menuProps, libraryOps });
  }, { wrapper });
  return { items: result.current.libraryMenuItems, menus: result.current, props, openZoneView, zoneCommands };
}

describe('useLibraryMenuItems', () => {
  it('follows desktop LibraryMenu', () => {
    expect(labels(setup().items)).toEqual([
      'Draw card', 'Draw cards...', 'Undo last draw', '---', 'Shuffle', '---',
      'View library', 'View top cards of library...', 'View bottom cards of library...', '---',
      'Reveal library to...', 'Lend library to...', 'Reveal top cards to...',
      'Always reveal top card', 'Always look at top card', '---',
      'Top of library...', 'Bottom of library...', '---', 'Open deck in deck editor',
    ]);
  });

  it('draws, views and reveals', () => {
    const { items, props, openZoneView, zoneCommands } = setup();
    find(items, 'Draw card').onClick!();
    expect(props.draw).toHaveBeenCalledWith(1);
    find(items, 'View library').onClick!();
    expect(openZoneView).toHaveBeenCalledWith({ playerId: 1, zoneName: ZoneName.DECK });
    find(items, 'Reveal library to...', 'All players').onClick!();
    find(items, 'Lend library to...', 'Opp').onClick!();
    expect(zoneCommands.reveal).toHaveBeenCalledWith(ZoneName.DECK, 'all');
    expect(zoneCommands.lendLibrary).toHaveBeenCalledWith(2);
    find(items, 'Reveal top cards to...', 'Opp').onClick!();
    expect(props.openRevealTopCardsPrompt).toHaveBeenCalledWith({ targetPlayerId: 2, deckSize: 30 });
  });

  it('still reveals to all players with no other players, as desktop does', () => {
    const { items, props, zoneCommands } = setup({ revealTargets: [] });
    expect(labels(find(items, 'Reveal library to...').submenu!)).toEqual(['All players', '---']);
    expect(labels(find(items, 'Reveal top cards to...').submenu!)).toEqual(['All players', '---']);
    expect(labels(find(items, 'Lend library to...').submenu!)).toEqual(['(no players)']);

    find(items, 'Reveal library to...', 'All players').onClick!();
    find(items, 'Reveal top cards to...', 'All players').onClick!();
    expect(zoneCommands.reveal).toHaveBeenCalledWith(ZoneName.DECK, 'all');
    expect(props.openRevealTopCardsPrompt).toHaveBeenCalledWith({ targetPlayerId: -1, deckSize: 30 });
  });

  it('shows the top-card toggles checked from the zone and flips them', () => {
    const { items, zoneCommands } = setup();
    expect(find(items, 'Always look at top card').checked).toBe(true);
    find(items, 'Always reveal top card').onClick!();
    find(items, 'Always look at top card').onClick!();
    expect(zoneCommands.setAlwaysRevealTopCard).toHaveBeenCalledWith(true);
    expect(zoneCommands.setAlwaysLookAtTopCard).toHaveBeenCalledWith(false);
  });

  it('addresses the top and bottom card by position', () => {
    const { items, zoneCommands } = setup();
    find(items, 'Top of library...', 'Play top card face down').onClick!();
    find(items, 'Bottom of library...', 'Move bottom card to exile').onClick!();
    expect(vi.mocked(zoneCommands.moveCards).mock.calls).toEqual([
      [ZoneName.DECK, [{ id: 0, faceDown: true }], { zone: ZoneName.TABLE, index: 'end' }],
      [ZoneName.DECK, [29], { zone: ZoneName.EXILE, index: 0 }],
    ]);
  });

  it('moves and shuffles N cards through the count prompt', () => {
    const { items, props, zoneCommands } = setup({ deckCount: 5 });
    find(items, 'Bottom of library...', 'Move bottom cards to graveyard face down...').onClick!();
    expect(vi.mocked(props.openCountPrompt).mock.calls[0][0].title).toBe('Move bottom cards to Graveyard');
    vi.mocked(props.openCountPrompt).mock.calls[0][0].onSubmit(2);
    expect(zoneCommands.moveCards).toHaveBeenCalledWith(
      ZoneName.DECK, [{ id: 3, faceDown: true }, { id: 4, faceDown: true }], { zone: ZoneName.GRAVE },
    );
    find(items, 'Top of library...', 'Shuffle top cards...').onClick!();
    expect(vi.mocked(props.openCountPrompt).mock.calls[1][0].title).toBe('Shuffle top cards of library');
    vi.mocked(props.openCountPrompt).mock.calls[1][0].onSubmit(9);
    expect(zoneCommands.shuffleLibrary).toHaveBeenCalledWith({ start: 0, end: 4 });
  });

  it('uses the desktop prompt titles instead of the menu labels', () => {
    const { items, props } = setup();
    find(items, 'Top of library...', 'Move top cards to exile...').onClick!();
    find(items, 'Bottom of library...', 'Draw bottom cards...').onClick!();
    find(items, 'Bottom of library...', 'Shuffle bottom cards...').onClick!();

    expect(vi.mocked(props.openCountPrompt).mock.calls.map(([options]) => options.title)).toEqual([
      'Move top cards to Exile',
      'Draw bottom cards',
      'Shuffle bottom cards of library',
    ]);
  });

  it('disables library actions on an empty library and the deck link without a saved deck', () => {
    const { items } = setup({ deckCount: 0 });
    expect(find(items, 'Draw card').disabled).toBe(true);
    expect(find(items, 'Top of library...').disabled).toBe(true);
    expect(find(items, 'Undo last draw').disabled).toBeUndefined();
    expect(find(items, 'Open deck in deck editor').disabled).toBe(true);
    expect(find(setup({ onOpenDeckInEditor: vi.fn() }).items, 'Open deck in deck editor').disabled).toBe(false);
  });

  it('shows the shortcut hint of every top and bottom card item', () => {
    const { items } = setup({ menuShortcut: (id) => ({ shortcut: `<${id}>`, keyShortcuts: '' }) });
    const hinted = (path: string) =>
      find(items, path).submenu!.filter((i): i is Item => 'label' in i).map((i) => i.shortcut);
    expect(hinted('Top of library...')).toEqual([
      '<game.playTop>', '<game.moveTopToPlayFaceDown>', '<game.moveTopToBottom>', '<game.moveTopToGrave>',
      '<game.moveTopNToGrave>', '<game.moveTopNToGraveFaceDown>', '<game.moveTopToExile>', '<game.moveTopNToExile>',
      '<game.moveTopNToExileFaceDown>', '<game.moveTopUntil>', '<game.shuffleTopCards>',
    ]);
    expect(hinted('Bottom of library...')).toEqual([
      '<game.drawBottomCard>', '<game.drawBottomCards>', '<game.moveBottomToPlay>', '<game.moveBottomToPlayFaceDown>',
      '<game.moveBottomToTop>', '<game.moveBottomToGrave>', '<game.moveBottomNToGrave>', '<game.moveBottomNToGraveFaceDown>',
      '<game.moveBottomToExile>', '<game.moveBottomNToExile>', '<game.moveBottomNToExileFaceDown>', '<game.shuffleBottomCards>',
    ]);
  });

  it('returns the top and bottom submenus for the library pile\'s menu', () => {
    const { items, menus } = setup();
    expect(find(items, 'Top of library...').submenu).toBe(menus.topLibraryItems);
    expect(find(items, 'Bottom of library...').submenu).toBe(menus.bottomLibraryItems);
  });
});
