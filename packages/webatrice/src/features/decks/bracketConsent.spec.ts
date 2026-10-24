import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';

import { getSettings, settingsStore } from '@app/hooks';
import { dexieService } from '@app/services';
import { CommanderSpellbookIntegration } from '@app/types';

vi.unmock('dexie');

import { lookupsAllowedFor, useBracketLookupsMode, writeBracketLookupsMode } from './bracketConsent';

beforeEach(async () => {
  settingsStore.reset();
  await dexieService.settings.clear();
  await getSettings();
});

afterEach(() => {
  settingsStore.reset();
});

describe('bracket lookups consent', () => {
  it('asks first by default, as desktop does', () => {
    const { result } = renderHook(() => useBracketLookupsMode());
    expect(result.current[0]).toBe(CommanderSpellbookIntegration.Unprompted);
  });

  it('allows lookups only when Automatic, or Enabled and asked for', () => {
    expect(lookupsAllowedFor(CommanderSpellbookIntegration.Unprompted, true)).toBe(false);
    expect(lookupsAllowedFor(CommanderSpellbookIntegration.Disabled, true)).toBe(false);
    expect(lookupsAllowedFor(CommanderSpellbookIntegration.Enabled, false)).toBe(false);
    expect(lookupsAllowedFor(CommanderSpellbookIntegration.Enabled, true)).toBe(true);
    expect(lookupsAllowedFor(CommanderSpellbookIntegration.Automatic, false)).toBe(true);
  });

  it('remembers the choice on the settings row', async () => {
    await writeBracketLookupsMode(CommanderSpellbookIntegration.Automatic);
    settingsStore.reset();
    expect((await getSettings()).commanderSpellbookIntegration).toBe(CommanderSpellbookIntegration.Automatic);
  });

  it('updates every hook user when one of them changes it', async () => {
    const first = renderHook(() => useBracketLookupsMode());
    const second = renderHook(() => useBracketLookupsMode());

    act(() => first.result.current[1](CommanderSpellbookIntegration.Enabled));
    await waitFor(() => expect(second.result.current[0]).toBe(CommanderSpellbookIntegration.Enabled));

    act(() => second.result.current[1](CommanderSpellbookIntegration.Disabled));
    await waitFor(() => expect(first.result.current[0]).toBe(CommanderSpellbookIntegration.Disabled));
  });
});
