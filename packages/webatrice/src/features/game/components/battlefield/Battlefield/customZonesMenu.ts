import type { TFunction } from 'i18next';

import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';

export function buildCustomZonesMenu(
  t: TFunction,
  zones: readonly { name: string }[],
  onView: (zoneName: string) => void,
): ContextMenuItem[] {
  if (zones.length === 0) {
    return [];
  }
  return [{
    label: t('PlayerMenu.customZones'),
    submenu: zones.map((zone) => ({
      label: t('PlayerMenu.viewCustomZone', { name: zone.name }),
      onClick: () => onView(zone.name),
    })),
  }];
}
