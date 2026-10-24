import { useSyncExternalStore } from 'react';

import { getOpenedReplays, subscribeOpenedReplays, type OpenedReplay } from '@app/services';

export function useOpenedReplays(): readonly OpenedReplay[] {
  return useSyncExternalStore(subscribeOpenedReplays, getOpenedReplays);
}
