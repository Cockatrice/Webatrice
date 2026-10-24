import type { ActionId } from '@app/feature-widgets/shortcuts';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../menus.i18n.json';
import zoneText from '../../../dialogs/shared/zoneLabels.i18n.json';

import { counterColorForId } from '../../ui/SeatCard/counterColors';
import {
  buildCardContextMenu,
  buildOpponentCardMenu,
  type BuildCardContextMenuArgs,
  type BuildOpponentCardMenuArgs,
} from './cardContextMenu.model';
import type { ContextMenuItem as CardMenuItem } from '../ContextMenu/ContextMenu';

const menuShortcut = (id: ActionId) => ({ shortcut: `<${id}>`, keyShortcuts: '' });
const t = catalogT(menuText, zoneText);

function makeArgs(overrides: Partial<BuildCardContextMenuArgs> = {}): BuildCardContextMenuArgs {
  const handler = () => vi.fn();
  return {
    t,
    menuShortcut,
    faceDown: false,
    doesntUntap: false,
    isAttached: false,
    onTapUntap: handler(),
    onFlip: handler(),
    onPeek: handler(),
    onSkipUntapping: handler(),
    onClone: handler(),
    onSetAnnotation: handler(),
    onMoveToTop: handler(),
    onMoveToBottom: handler(),
    onMoveToTable: handler(),
    onMoveToHand: handler(),
    onMoveToGrave: handler(),
    onMoveToExile: handler(),
    onMoveToXCardsFromTop: handler(),
    onIncP: handler(),
    onDecP: handler(),
    onFlowP: handler(),
    onIncT: handler(),
    onDecT: handler(),
    onFlowT: handler(),
    onIncPT: handler(),
    onDecPT: handler(),
    onSetPT: handler(),
    onResetPT: handler(),
    onAttachToCard: handler(),
    onUnattach: handler(),
    onDrawArrow: handler(),
    onReduceLifeByPower: handler(),
    onSelectAll: handler(),
    onSelectRow: handler(),
    onAddCardCounter: handler(),
    onSetCardCounter: handler(),
    ...overrides,
  };
}

function tree(items: CardMenuItem[], depth = 0): string[] {
  return items.flatMap((item) => {
    const pad = '  '.repeat(depth);
    if ('divider' in item) {
      return [`${pad}---`];
    }
    const line = [
      item.label,
      item.shortcut ? `[${item.shortcut}]` : '',
      item.checked ? '✓' : '',
      item.swatch ? `(${item.swatch})` : '',
    ].filter(Boolean).join(' ');
    return [`${pad}${line}`, ...(item.submenu ? tree(item.submenu, depth + 1) : [])];
  });
}

const find = (items: CardMenuItem[], ...path: string[]): Exclude<CardMenuItem, { divider: true }> => {
  let level = items;
  let found: CardMenuItem | undefined;
  for (const label of path) {
    found = level.find((i) => !('divider' in i) && i.label === label);
    if (!found || 'divider' in found) {
      throw new Error(`no menu row ${path.join(' > ')}`);
    }
    level = found.submenu ?? [];
  }
  return found as Exclude<CardMenuItem, { divider: true }>;
};

describe('buildCardContextMenu', () => {
  it('builds the own face-up battlefield card menu', () => {
    expect(tree(buildCardContextMenu(makeArgs()))).toEqual([
      'Tap / Untap [<game.tapCard>]',
      'Skip untapping [<game.doesntUntap>]',
      'Turn Over [<game.flipCard>]',
      '---',
      'Clone [<game.cloneCard>]',
      'Move to',
      '  Top of library in random order [<game.moveSelectedToLibraryTop>]',
      '  X cards from the top of library...',
      '  Bottom of library in random order [<game.moveSelectedToLibraryBottom>]',
      '  ---',
      '  Table [<game.moveSelectedToBattlefield>]',
      '  Hand [<game.moveSelectedToHand>]',
      '  ---',
      '  Graveyard [<game.moveSelectedToGrave>]',
      '  Exile [<game.moveSelectedToExile>]',
      '---',
      'Attach to card... [<game.attachCard>]',
      'Draw arrow... [<game.drawArrow>]',
      '---',
      'Power / toughness',
      '  Increase power [<game.incP>]',
      '  Decrease power [<game.decP>]',
      '  Increase power and decrease toughness [<game.flowP>]',
      '  ---',
      '  Increase toughness [<game.incT>]',
      '  Decrease toughness [<game.decT>]',
      '  Decrease power and increase toughness [<game.flowT>]',
      '  ---',
      '  Increase power and toughness [<game.incPT>]',
      '  Decrease power and toughness [<game.decPT>]',
      '  ---',
      '  Set power and toughness... [<game.setCardPT>]',
      '  Reset power and toughness [<game.resetPT>]',
      'Set annotation... [<game.setAnnotation>]',
      '---',
      'Reduce life by power [<game.reduceLifeByPower>]',
      '---',
      'Select All [<game.selectAllBattlefield>]',
      'Select Row [<game.selectRowBattlefield>]',
      '---',
      'Card counters',
      ...['A', 'B', 'C', 'D', 'E', 'F'].flatMap((letter, i) => [
        ...(i > 0 ? ['  ---'] : []),
        `  Add counter (${letter}) [<game.addCounter${letter}>] (${counterColorForId(i)})`,
        `  Set counters (${letter})... [<game.setCounter${letter}>] (${counterColorForId(i)})`,
      ]),
    ]);
  });

  it('adds peek and the face-up label for a face-down card, unattach for an attached one, and checks skip-untapping', () => {
    const rows = tree(buildCardContextMenu(makeArgs({ faceDown: true, isAttached: true, doesntUntap: true })));
    expect(rows.slice(0, 4)).toEqual([
      'Tap / Untap [<game.tapCard>]',
      'Skip untapping [<game.doesntUntap>] ✓',
      'Turn Over (face up) [<game.flipCard>]',
      'Peek at card face [<game.peekCard>]',
    ]);
    expect(rows).toContain('Unattach [<game.unattachCard>]');
    expect(rows.indexOf('Unattach [<game.unattachCard>]')).toBe(rows.indexOf('Attach to card... [<game.attachCard>]') + 1);
  });

  it('appends related-card items after a divider, and nothing for an empty list', () => {
    const token: CardMenuItem = { label: 'Token: 1/1 Soldier' };
    expect(tree(buildCardContextMenu(makeArgs({ tokenItems: [token] }))).slice(-2)).toEqual(['---', 'Token: 1/1 Soldier']);
    expect(tree(buildCardContextMenu(makeArgs({ tokenItems: [] }))).at(-1)).toMatch(/^ {2}Set counters \(F\)/);
  });

  it('places "View related cards" between Card counters and the token items', () => {
    const rows = tree(buildCardContextMenu(makeArgs({
      relatedViewItems: [{ divider: true }, { label: 'View related cards', submenu: [{ label: 'Spark Elemental' }] }],
      tokenItems: [{ label: 'Token: 1/1 Soldier' }],
    })));
    expect(rows.slice(-5)).toEqual(['---', 'View related cards', '  Spark Elemental', '---', 'Token: 1/1 Soldier']);
  });

  it('wires each row to its handler, passing the counter slot', () => {
    const args = makeArgs();
    const menu = buildCardContextMenu(args);
    find(menu, 'Move to', 'Graveyard').onClick!();
    find(menu, 'Power / toughness', 'Increase power and decrease toughness').onClick!();
    find(menu, 'Card counters', 'Add counter (C)').onClick!();
    find(menu, 'Card counters', 'Set counters (E)...').onClick!();

    expect(args.onMoveToGrave).toHaveBeenCalledTimes(1);
    expect(args.onFlowP).toHaveBeenCalledTimes(1);
    expect(args.onAddCardCounter).toHaveBeenCalledWith(2);
    expect(args.onSetCardCounter).toHaveBeenCalledWith(4);
  });
});

describe('buildOpponentCardMenu', () => {
  const opponentArgs = (overrides: Partial<BuildOpponentCardMenuArgs> = {}): BuildOpponentCardMenuArgs => ({
    t,
    menuShortcut,
    onDrawArrow: vi.fn(),
    onClone: vi.fn(),
    onReduceLifeByPower: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectRow: vi.fn(),
    ...overrides,
  });

  it('offers only the actions that leave the other player\'s cards alone', () => {
    expect(tree(buildOpponentCardMenu(opponentArgs()))).toEqual([
      'Draw arrow... [<game.drawArrow>]',
      'Clone [<game.cloneCard>]',
      '---',
      'Reduce life by power [<game.reduceLifeByPower>]',
      '---',
      'Select All [<game.selectAllBattlefield>]',
      'Select Row [<game.selectRowBattlefield>]',
    ]);
  });

  it('ends with the related-card views, then the token items after a divider', () => {
    const rows = tree(buildOpponentCardMenu(opponentArgs({
      relatedViewItems: [{ divider: true }, { label: 'View related cards' }],
      tokenItems: [{ label: 'Token: 0/1 Plant' }],
    })));
    expect(rows.slice(-5)).toEqual(['Select Row [<game.selectRowBattlefield>]', '---', 'View related cards', '---', 'Token: 0/1 Plant']);
    expect(tree(buildOpponentCardMenu(opponentArgs({ tokenItems: [] }))).at(-1)).toBe('Select Row [<game.selectRowBattlefield>]');
  });

  it('wires each row to its handler', () => {
    const args = opponentArgs();
    const menu = buildOpponentCardMenu(args);
    for (const label of ['Draw arrow...', 'Clone', 'Reduce life by power', 'Select All', 'Select Row']) {
      find(menu, label).onClick!();
    }
    for (const handler of [args.onDrawArrow, args.onClone, args.onReduceLifeByPower, args.onSelectAll, args.onSelectRow]) {
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });
});
