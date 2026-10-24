import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { testI18n } from '../../../../../__test-utils__/renderWithProviders';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../../../hooks/dialogs/gameDialogs.types';
import { GameDialogActionsProvider, type GameDialogActions } from '../../ui/GameDialogActionsContext';
import { GameDialogsProvider } from '../../ui/GameDialogsContext';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCounterCommands,
} from '../../ui/PlayerBoard/playerBoard.types';
import { useBattlefieldMenuItems, type UseBattlefieldMenuItemsArgs } from './useBattlefieldMenuItems';

type Item = Extract<ContextMenuItem, { label: string }>;
const labels = (items: ContextMenuItem[]) => items.map((i) => ('divider' in i ? '---' : i.label));
const find = (items: ContextMenuItem[], ...path: string[]): Item => {
  let item = items.find((i): i is Item => 'label' in i && i.label === path[0])!;
  for (const label of path.slice(1)) {
    item = item.submenu!.find((i): i is Item => 'label' in i && i.label === label)!;
  }
  return item;
};

const bf = (id: number, counters: { id: number; value: number }[] = []): BattlefieldCardViewModel => ({
  id: String(id),
  name: `Card ${id}`,
  scryfallId: '',
  slot: { row: 0, col: id },
  subSlot: 0,
  tapped: false,
  counters,
});

const marker = (label: string): ContextMenuItem[] => [{ label }];

function setup(args: Partial<UseBattlefieldMenuItemsArgs> = {}) {
  const actions = { onRequestRollDie: vi.fn(), onRequestGameInfo: vi.fn(), onRequestViewSideboard: vi.fn() };
  const cardCommands = { untapAll: vi.fn(), createToken: vi.fn() } as unknown as PlayerCardCommands;
  const counterCommands = { increment: vi.fn(), flipCoin: vi.fn() } as unknown as PlayerCounterCommands;
  const props: UseBattlefieldMenuItemsArgs = {
    seatId: 1,
    customZones: [],
    onSay: undefined,
    handMenuItems: marker('hand items'),
    libraryMenuItems: marker('library items'),
    graveMenuItemsSelf: marker('own graveyard items'),
    graveMenuItemsOpponent: marker('graveyard views'),
    exileMenuItemsSelf: marker('own exile items'),
    exileMenuItemsOpponent: marker('exile views'),
    lifeControl: { value: 20, onDelta: vi.fn(), onSet: vi.fn() },
    openLifePrompt: vi.fn(),
    openCounterPrompt: vi.fn(),
    manaCounters: { G: { id: 6, count: 2 } },
    incrementAllCardCounters: vi.fn(),
    battlefieldDisplayList: [bf(10, [{ id: 0, value: 1 }]), bf(11, [{ id: 1, value: 999 }]), bf(12)],
    lastToken: null,
    openCreateTokenDialog: vi.fn(),
    menuShortcut: () => ({ shortcut: '', keyShortcuts: '' }),
    cardCommands,
    counterCommands,
    ...args,
  };
  const dialogs = { ...NOOP_GAME_DIALOGS_ACTIONS, openZoneView: vi.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={testI18n}>
      <GameDialogsProvider value={dialogs as unknown as GameDialogs}>
        <GameDialogActionsProvider value={actions as unknown as GameDialogActions}>{children}</GameDialogActionsProvider>
      </GameDialogsProvider>
    </I18nextProvider>
  );
  const { result } = renderHook(() => useBattlefieldMenuItems(props), { wrapper });
  return { ...result.current, props, actions, dialogs, cardCommands, counterCommands };
}

describe('useBattlefieldMenuItems', () => {
  it('follows desktop PlayerMenu, nesting the zone menus', () => {
    const { battlefieldMenuItems } = setup();
    expect(labels(battlefieldMenuItems)).toEqual([
      'Hand', 'Library', 'Graveyard', 'Exile', 'Sideboard', '---',
      'Counters', 'Increment all card counters', '---', 'Untap all permanents', '---',
      'Roll die...', 'Flip coin', '---',
      'Create token...', 'Create another token', 'Create predefined token', '---', 'Game info...',
      'Tally',
    ]);
    expect(labels(find(battlefieldMenuItems, 'Hand').submenu!)).toEqual(['hand items']);
    expect(labels(find(battlefieldMenuItems, 'Graveyard').submenu!)).toEqual(['own graveyard items']);
  });

  it('ends the local seat\'s menu with Say after Tally', () => {
    const { battlefieldMenuItems } = setup({ onSay: vi.fn() });
    expect(labels(battlefieldMenuItems).slice(-2)).toEqual(['Tally', 'Say']);
    expect(labels(setup().battlefieldMenuItems).slice(-1)).toEqual(['Tally']);
  });

  it('lists custom zones after Sideboard and views one by name', () => {
    const { battlefieldMenuItems, dialogs } = setup({ customZones: [{ name: 'command' }] });
    expect(labels(battlefieldMenuItems).slice(4, 7)).toEqual(['Sideboard', 'Custom Zones', '---']);
    find(battlefieldMenuItems, 'Custom Zones', 'View custom zone \'command\'').onClick!();
    expect(dialogs.openZoneView).toHaveBeenCalledWith({ playerId: 1, zoneName: 'command' });
  });

  it('gives another viewer the graveyard and exile views and Tally only', () => {
    const { opponentBattlefieldMenuItems } = setup();
    expect(opponentBattlefieldMenuItems.slice(0, 2)).toEqual([
      { label: 'Graveyard', submenu: marker('graveyard views') },
      { label: 'Exile', submenu: marker('exile views') },
    ]);
    expect(labels(opponentBattlefieldMenuItems)).toEqual(['Graveyard', 'Exile', 'Tally']);
  });

  it('builds a set / +-10 submenu per player counter, life included', () => {
    const { battlefieldMenuItems, props, counterCommands } = setup();
    const life = find(battlefieldMenuItems, 'Counters', 'Life').submenu!;
    expect(labels(life).slice(0, 3)).toEqual(['Set counter...', '---', '+10']);
    expect(life).toHaveLength(2 + 10 + 1 + 10);
    find(battlefieldMenuItems, 'Counters', 'Life', '-3').onClick!();
    expect(props.lifeControl!.onDelta).toHaveBeenCalledWith(-3);

    find(battlefieldMenuItems, 'Counters', 'Green', '+2').onClick!();
    expect(counterCommands.increment).toHaveBeenCalledWith(6, 2);
    find(battlefieldMenuItems, 'Counters', 'Green', 'Set counter...').onClick!();
    expect(props.openCounterPrompt).toHaveBeenCalledWith({ counterId: 6, label: 'Green', currentValue: 2 });
    expect(find(battlefieldMenuItems, 'Counters', 'White').disabled).toBe(true);
  });

  it('shows each counter\'s set, +1 and -1 shortcuts', () => {
    const { battlefieldMenuItems } = setup({ menuShortcut: (id) => ({ shortcut: `<${id}>`, keyShortcuts: '' }) });
    const hinted = (counter: string) =>
      ['Set counter...', '+1', '-1', '+2'].map((label) => find(battlefieldMenuItems, 'Counters', counter, label).shortcut);
    expect(hinted('Life')).toEqual(['<game.setLife>', '<game.incLife>', '<game.decLife>', undefined]);
    expect(hinted('Green')).toEqual(['<game.setManaCounterG>', '<game.incManaCounterG>', '<game.decManaCounterG>', undefined]);
    expect(hinted('Colorless')).toEqual(['<game.setManaCounterX>', '<game.incManaCounterX>', '<game.decManaCounterX>', undefined]);
    expect(hinted('Other')).toEqual(['<game.setStormCounter>', '<game.addStormCounter>', '<game.removeStormCounter>', undefined]);
  });

  it('increments all card counters through the seat\'s card op, disabled on an empty battlefield', () => {
    const board = setup();
    find(board.battlefieldMenuItems, 'Increment all card counters').onClick!();
    expect(board.props.incrementAllCardCounters).toHaveBeenCalledOnce();
    expect(find(setup({ battlefieldDisplayList: [] }).battlefieldMenuItems, 'Increment all card counters').disabled).toBe(true);
  });

  it('runs the utility items and offers another token only once one was made', () => {
    const { battlefieldMenuItems, actions, cardCommands, counterCommands } = setup();
    find(battlefieldMenuItems, 'Untap all permanents').onClick!();
    find(battlefieldMenuItems, 'Flip coin').onClick!();
    find(battlefieldMenuItems, 'Roll die...').onClick!();
    find(battlefieldMenuItems, 'Sideboard', 'View sideboard').onClick!();
    expect(cardCommands.untapAll).toHaveBeenCalled();
    expect(counterCommands.flipCoin).toHaveBeenCalled();
    expect(actions.onRequestRollDie).toHaveBeenCalled();
    expect(actions.onRequestViewSideboard).toHaveBeenCalled();
    expect(find(battlefieldMenuItems, 'Create another token').disabled).toBe(true);

    const token = { name: 'Goblin', color: 'r', pt: '1/1', annotation: '', destroyOnZoneChange: true, faceDown: false };
    const again = setup({ lastToken: token });
    find(again.battlefieldMenuItems, 'Create another token').onClick!();
    expect(again.cardCommands.createToken).toHaveBeenCalledWith(token);
  });
});
