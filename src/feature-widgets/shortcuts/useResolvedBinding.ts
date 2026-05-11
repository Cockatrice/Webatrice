import { ShortcutsSelectors, useAppSelector } from '@app/store';

import { defaults } from './defaults';
import { ActionId } from './types';

const EMPTY: string[] = [];

/**
 * Resolved binding for a given action: the user's override if set, otherwise the default
 * from the catalog. Lives in the shortcuts widget alongside the catalog it depends on
 * and is consumed by the SettingsTab UI in the same widget.
 */
export function useResolvedBinding(actionId: ActionId): string[] {
  const overrides = useAppSelector(ShortcutsSelectors.getOverrides);
  return overrides[actionId] ?? defaults[actionId]?.sequences ?? EMPTY;
}
