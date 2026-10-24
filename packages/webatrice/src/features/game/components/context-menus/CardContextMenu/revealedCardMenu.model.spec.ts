import type { ActionId } from '@app/feature-widgets/shortcuts';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../menus.i18n.json';

import type { ContextMenuItem as CardMenuItem } from '../ContextMenu/ContextMenu';
import { buildRevealedCardMenu } from './revealedCardMenu.model';

const menuShortcut = (id: ActionId) => ({ shortcut: `<${id}>`, keyShortcuts: '' });
const t = catalogT(menuText);

function rows(items: CardMenuItem[]): string[] {
  return items.map((item) => ('divider' in item ? '---' : [item.label, item.shortcut ? `[${item.shortcut}]` : ''].join(' ').trim()));
}

describe('buildRevealedCardMenu', () => {
  it('builds desktop\'s revealed-card menu', () => {
    const menu = buildRevealedCardMenu({
      t,
      menuShortcut,
      onHide: vi.fn(),
      onClone: vi.fn(),
      onSelectAll: vi.fn(),
      relatedViewItems: [{ divider: true }, { label: 'View related cards', submenu: [] }],
    });
    expect(rows(menu)).toEqual([
      'Hide [<game.hideRevealedCard>]',
      '---',
      'Clone [<game.cloneCard>]',
      '---',
      'Select All [<game.selectAllBattlefield>]',
      '---',
      'View related cards',
    ]);
  });

  it('disables Clone when replay commands are unavailable', () => {
    const menu = buildRevealedCardMenu({
      t, menuShortcut, onHide: vi.fn(), onClone: vi.fn(), onSelectAll: vi.fn(), canClone: false,
    });
    expect(menu[2]).toMatchObject({ label: 'Clone', disabled: true });
  });

  it('wires Hide, Clone and Select All', () => {
    const args = { t, menuShortcut, onHide: vi.fn(), onClone: vi.fn(), onSelectAll: vi.fn() };
    const menu = buildRevealedCardMenu(args);
    for (const item of menu) {
      if (!('divider' in item)) {
        item.onClick?.();
      }
    }
    expect(args.onHide).toHaveBeenCalledTimes(1);
    expect(args.onClone).toHaveBeenCalledTimes(1);
    expect(args.onSelectAll).toHaveBeenCalledTimes(1);
  });
});
