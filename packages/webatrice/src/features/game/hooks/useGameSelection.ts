import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

import { EMPTY_SELECTION } from '../utils/selection';

export interface GameSelection {
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
  clearSelection: () => void;
}

export function useGameSelection(): GameSelection {
  const [selectedCardKeys, setSelectedCardKeys] = useState<ReadonlySet<string>>(EMPTY_SELECTION);

  const clearSelection = useCallback(() => {
    setSelectedCardKeys(EMPTY_SELECTION);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.MuiDialog-root[role="dialog"]')) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  return { selectedCardKeys, setSelectedCardKeys, clearSelection };
}
