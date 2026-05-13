import { shortcuts, useAppSelector } from '@app/store';

import { defaults } from './defaults';
import { ActionId } from './types';

const EMPTY: string[] = [];

export function useResolvedBinding(actionId: ActionId): string[] {
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);
  return overrides[actionId] ?? defaults[actionId]?.sequences ?? EMPTY;
}
