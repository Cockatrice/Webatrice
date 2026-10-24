import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../../context-menus/menus.i18n.json';
import commonText from '../../../../../common.i18n.json';
import tallyText from '../../TallyOverlay/TallyOverlay.i18n.json';
import { buildTallyMenu } from './tallyMenu';

type Item = Extract<ContextMenuItem, { label: string }>;
const t = catalogT(menuText, commonText, tallyText);

describe('buildTallyMenu', () => {
  it('checks exactly the current tally and sets the picked one', () => {
    const onSet = vi.fn();
    const menu = buildTallyMenu(t, 'power', onSet) as Item;
    expect(menu.label).toBe('Tally');
    expect(menu.submenu!.map((i) => ('divider' in i ? '---' : `${i.checked ? '✓ ' : ''}${i.label}`)))
      .toEqual(['None', '---', 'Subtypes', '✓ Total Power', 'Total Toughness']);

    (menu.submenu![2] as Item).onClick!();
    expect(onSet).toHaveBeenCalledWith('subtypes');
  });
});
