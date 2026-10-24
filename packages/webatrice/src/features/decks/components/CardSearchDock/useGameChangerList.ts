import { useEffect, useState } from 'react';

import { CommanderSpellbookIntegration } from '@app/types';

import { useBracketLookupsMode } from '../../bracketConsent';
import { fetchGameChangers } from '../../bracketSources';

export function bracketLookupsConsented(mode: CommanderSpellbookIntegration): boolean {
  return mode === CommanderSpellbookIntegration.Enabled || mode === CommanderSpellbookIntegration.Automatic;
}

export function useGameChangerList(wanted: boolean): ReadonlySet<string> | null {
  const [mode] = useBracketLookupsMode();
  const enabled = wanted && bracketLookupsConsented(mode);
  const [list, setList] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let live = true;
    void fetchGameChangers().then((result) => {
      if (live && result.status !== 'unavailable') {
        setList(result.data);
      }
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return enabled ? list : null;
}
