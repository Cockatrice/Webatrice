import { useCallback } from 'react';

import { getSettings, settingsStore, usePreference } from '@app/hooks';
import { CommanderSpellbookIntegration } from '@app/types';

export function lookupsAllowedFor(mode: CommanderSpellbookIntegration, requestedNow: boolean): boolean {
  return mode === CommanderSpellbookIntegration.Automatic
    || (mode === CommanderSpellbookIntegration.Enabled && requestedNow);
}

export async function writeBracketLookupsMode(mode: CommanderSpellbookIntegration): Promise<void> {
  const settings = await getSettings();
  settings.commanderSpellbookIntegration = mode;
  await settings.save();
  settingsStore.setValue(settings);
}

export function useBracketLookupsMode(): [CommanderSpellbookIntegration, (mode: CommanderSpellbookIntegration) => void] {
  const mode = usePreference('commanderSpellbookIntegration');
  const setMode = useCallback((next: CommanderSpellbookIntegration) => void writeBracketLookupsMode(next), []);
  return [mode, setMode];
}
