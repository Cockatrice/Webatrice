import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import IntlMessageFormat from 'intl-messageformat';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../../context-menus/menus.i18n.json';
import { buildCustomZonesMenu } from './customZonesMenu';

type Item = Extract<ContextMenuItem, { label: string }>;
const t = catalogT(menuText);

describe('buildCustomZonesMenu', () => {
  it('formats the custom-zone placeholder inside literal apostrophes', () => {
    const message = new IntlMessageFormat(menuText.PlayerMenu.viewCustomZone, 'en');
    expect(message.format({ name: 'command' })).toBe('View custom zone \'command\'');
  });

  it('is hidden while the player has no custom zone', () => {
    expect(buildCustomZonesMenu(t, [], vi.fn())).toEqual([]);
  });

  it('views each zone by name', () => {
    const onView = vi.fn();
    const [menu] = buildCustomZonesMenu(t, [{ name: 'command' }, { name: 'vault' }], onView) as Item[];
    expect(menu.label).toBe('Custom Zones');
    expect(menu.submenu!.map((i) => (i as Item).label))
      .toEqual(['View custom zone \'command\'', 'View custom zone \'vault\'']);
    (menu.submenu![1] as Item).onClick!();
    expect(onView).toHaveBeenCalledWith('vault');
  });
});
