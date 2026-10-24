import type { TFunction } from 'i18next';

import type { TallyType } from '../../../utils/tally';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';

export function buildTallyMenu(t: TFunction, current: TallyType, onSet: (type: TallyType) => void): ContextMenuItem {
  const option = (type: TallyType, label: string): ContextMenuItem => ({
    label,
    checked: current === type,
    onClick: () => onSet(type),
  });
  return {
    label: t('TallyOverlay.tally'),
    submenu: [
      option('none', t('Common.label.none')),
      { divider: true },
      option('subtypes', t('PlayerMenu.tallySubtypes')),
      option('power', t('PlayerMenu.tallyPower')),
      option('toughness', t('PlayerMenu.tallyToughness')),
    ],
  };
}
