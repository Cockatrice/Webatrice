import type { ActionId } from '@app/feature-widgets/shortcuts';
import type { TFunction } from 'i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../../context-menus/ContextMenu/ContextMenu';

export const SAY_MACRO_ACTIONS = [
  'game.sayMacro1',
  'game.sayMacro2',
  'game.sayMacro3',
  'game.sayMacro4',
  'game.sayMacro5',
  'game.sayMacro6',
  'game.sayMacro7',
  'game.sayMacro8',
  'game.sayMacro9',
  'game.sayMacro10',
] as const satisfies readonly ActionId[];

export function buildSayMenu(
  t: TFunction,
  macros: readonly string[],
  menuShortcut: MenuShortcutFor,
  onSay: (message: string) => void,
): ContextMenuItem {
  return {
    label: t('PlayerMenu.say'),
    disabled: macros.length === 0,
    submenu: macros.map((message, i) => ({
      label: message,
      ...(i < SAY_MACRO_ACTIONS.length ? menuShortcut(SAY_MACRO_ACTIONS[i]) : {}),
      onClick: () => onSay(message),
    })),
  };
}
