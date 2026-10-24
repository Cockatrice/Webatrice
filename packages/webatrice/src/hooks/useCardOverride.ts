import { useCallback, useState } from 'react';

import { CardDataSettingsDTO } from '../services/dexie/DexieDTOs/CardDataSettingsDTO';
import { cardOverride } from '../services/cardDatabase/cardOverrides';
import { refreshCardDataPreferences, useCardDataPreferences } from './useCardDataPreferences';

export interface CardOverrideControl {
  pinnedPrintingId?: string;
  savingPin: boolean;
  togglePin: (providerId: string) => Promise<void>;
}

export function useCardOverride(name: string | undefined): CardOverrideControl {
  const preferences = useCardDataPreferences();
  const pinnedPrintingId = cardOverride(preferences.value?.cardOverrides, name ?? '');
  const [savingPin, setSavingPin] = useState(false);
  const togglePin = useCallback(async (providerId: string) => {
    if (!name) {
      return;
    }
    setSavingPin(true);
    try {
      await CardDataSettingsDTO.setCardOverride(name, pinnedPrintingId === providerId ? undefined : providerId);
      await refreshCardDataPreferences();
    } finally {
      setSavingPin(false);
    }
  }, [name, pinnedPrintingId]);

  return { pinnedPrintingId, savingPin, togglePin };
}
