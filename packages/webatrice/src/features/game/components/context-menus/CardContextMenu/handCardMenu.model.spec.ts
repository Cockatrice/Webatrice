import type { ActionId } from '@app/feature-widgets/shortcuts';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../menus.i18n.json';
import zoneText from '../../../dialogs/shared/zoneLabels.i18n.json';

import type { ContextMenuItem as CardMenuItem } from '../ContextMenu/ContextMenu';
import { buildHandOrZoneCardMenu, type BuildHandOrZoneCardMenuArgs } from './handCardMenu.model';

const menuShortcut = (id: ActionId) => ({ shortcut: `<${id}>`, keyShortcuts: '' });
const t = catalogT(menuText, zoneText);

function makeArgs(overrides: Partial<BuildHandOrZoneCardMenuArgs> = {}): BuildHandOrZoneCardMenuArgs {
  return {
    t,
    menuShortcut,
    source: 'hand',
    canModify: true,
    revealTargets: [{ playerId: 2, name: 'Bob' }, { playerId: 3, name: 'Cy' }],
    onPlay: vi.fn(),
    onPlayFaceDown: vi.fn(),
    onReveal: vi.fn(),
    onClone: vi.fn(),
    onMove: vi.fn(),
    onDrawArrow: vi.fn(),
    onSelectAll: vi.fn(),
    ...overrides,
  };
}

function tree(items: CardMenuItem[], depth = 0): string[] {
  return items.flatMap((item) => {
    const pad = '  '.repeat(depth);
    if ('divider' in item) {
      return [`${pad}---`];
    }
    const line = [item.label, item.shortcut ? `[${item.shortcut}]` : ''].filter(Boolean).join(' ');
    return [`${pad}${line}`, ...(item.submenu ? tree(item.submenu, depth + 1) : [])];
  });
}

function find(items: CardMenuItem[], ...path: string[]): Exclude<CardMenuItem, { divider: true }> {
  let level = items;
  let found: Exclude<CardMenuItem, { divider: true }> | undefined;
  for (const label of path) {
    found = level.find((i): i is Exclude<CardMenuItem, { divider: true }> => 'label' in i && i.label === label);
    if (!found) {
      throw new Error(`no item ${label}`);
    }
    level = found.submenu ?? [];
  }
  return found!;
}

const RELATED: CardMenuItem[] = [{ divider: true }, { label: 'View related cards', submenu: [{ label: 'Spark' }] }];
const TOKENS: CardMenuItem[] = [{ label: 'Token: 1/1 Soldier' }];

describe('buildHandOrZoneCardMenu', () => {
  it('builds desktop\'s hand card menu', () => {
    expect(tree(buildHandOrZoneCardMenu(makeArgs({ relatedViewItems: RELATED, tokenItems: TOKENS })))).toMatchInlineSnapshot(`
      [
        "Play [<game.playCard>]",
        "Play Face Down [<game.playCardFaceDown>]",
        "Reveal to...",
        "  All players [<game.revealSelectedToAll>]",
        "  ---",
        "  Bob",
        "  Cy",
        "---",
        "Clone [<game.cloneCard>]",
        "Move to",
        "  Top of library in random order [<game.moveSelectedToLibraryTop>]",
        "  X cards from the top of library...",
        "  Bottom of library in random order [<game.moveSelectedToLibraryBottom>]",
        "  ---",
        "  Table [<game.moveSelectedToBattlefield>]",
        "  ---",
        "  Hand [<game.moveSelectedToHand>]",
        "  ---",
        "  Graveyard [<game.moveSelectedToGrave>]",
        "  ---",
        "  Exile [<game.moveSelectedToExile>]",
        "---",
        "Draw arrow... [<game.drawArrow>]",
        "---",
        "Select All [<game.selectAllBattlefield>]",
        "---",
        "View related cards",
        "  Spark",
        "---",
        "Token: 1/1 Soldier",
      ]
    `);
  });

  it('drops Draw arrow and the token actions in a library or sideboard view, and adds Select Column', () => {
    const rows = tree(buildHandOrZoneCardMenu(makeArgs({
      source: 'zoneView',
      onSelectColumn: vi.fn(),
      relatedViewItems: RELATED,
      tokenItems: TOKENS,
    })));
    expect(rows).not.toContain('Draw arrow... [<game.drawArrow>]');
    expect(rows).not.toContain('Token: 1/1 Soldier');
    expect(rows.slice(-6)).toEqual([
      '---',
      'Select All [<game.selectAllBattlefield>]',
      'Select Column [<game.selectColumnBattlefield>]',
      '---',
      'View related cards',
      '  Spark',
    ]);
  });

  it('lists "All players" even with nobody else seated', () => {
    const menu = buildHandOrZoneCardMenu(makeArgs({ revealTargets: [] }));
    expect(tree(find(menu, 'Reveal to...').submenu ?? [])).toEqual(['All players [<game.revealSelectedToAll>]', '---']);
  });

  it('reveals to every player with -1 and to one player by id', () => {
    const args = makeArgs();
    const menu = buildHandOrZoneCardMenu(args);
    find(menu, 'Reveal to...', 'All players').onClick?.();
    find(menu, 'Reveal to...', 'Cy').onClick?.();
    find(menu, 'Move to', 'X cards from the top of library...').onClick?.();
    expect(vi.mocked(args.onReveal).mock.calls).toEqual([[-1], [3]]);
    expect(args.onMove).toHaveBeenCalledWith('libraryXFromTop');
  });

  it('is the read-only branch without write access', () => {
    expect(tree(buildHandOrZoneCardMenu(makeArgs({ canModify: false, relatedViewItems: RELATED })))).toEqual([
      'Draw arrow... [<game.drawArrow>]',
      '---',
      'Clone [<game.cloneCard>]',
      '---',
      'Select All [<game.selectAllBattlefield>]',
      '---',
      'View related cards',
      '  Spark',
    ]);
  });
});
