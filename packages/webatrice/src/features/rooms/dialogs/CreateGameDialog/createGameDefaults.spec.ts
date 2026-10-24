import {
  CREATE_GAME_DEFAULTS_KEY,
  initialCreateGameForm,
  initialPresetId,
  readCreateGameDefaults,
  writeCreateGameDefaults,
} from './createGameDefaults';
import { defaultCreateGameForm } from './createGamePresets';

describe('createGameDefaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('remembers by default when nothing is stored or storage is corrupt', () => {
    expect(readCreateGameDefaults()).toEqual({ remember: true });
    window.localStorage.setItem(CREATE_GAME_DEFAULTS_KEY, '{not json');
    expect(readCreateGameDefaults()).toEqual({ remember: true });
  });

  it('round-trips the remembered fields and the format by name, never the password or judge flag', () => {
    const form = { ...defaultCreateGameForm(true), description: 'Pod', password: 'pw', joinAsJudge: true, maxPlayers: 4, gameTypeId: 3 };
    writeCreateGameDefaults(true, form, { 3: 'Commander' }, 'commanderPod');
    const stored = readCreateGameDefaults();
    const restored = initialCreateGameForm(stored, { gametypeMap: { 9: 'Commander' }, isRegistered: true });
    expect(restored).toMatchObject({ description: 'Pod', password: '', joinAsJudge: false, maxPlayers: 4, gameTypeId: 9 });
  });

  it('drops a remembered format the room does not offer', () => {
    writeCreateGameDefaults(true, { ...defaultCreateGameForm(true), gameTypeId: 3 }, { 3: 'Commander' }, null);
    expect(initialCreateGameForm(readCreateGameDefaults(), { gametypeMap: { 1: 'Standard' }, isRegistered: true }).gameTypeId).toBeNull();
  });

  it('starts from the defaults when remembering is off', () => {
    writeCreateGameDefaults(false, { ...defaultCreateGameForm(true), maxPlayers: 6 }, {}, 'duelCommander');
    expect(readCreateGameDefaults()).toEqual({ remember: false, fields: undefined, gameTypeName: null, presetId: null });
    expect(initialCreateGameForm(readCreateGameDefaults(), { gametypeMap: {}, isRegistered: true }).maxPlayers).toBe(2);
  });

  it('clears buddy and registered restrictions for guests', () => {
    writeCreateGameDefaults(true, { ...defaultCreateGameForm(true), onlyBuddies: true }, {}, 'friendsOnly');
    expect(initialCreateGameForm(readCreateGameDefaults(), { gametypeMap: {}, isRegistered: false })).toMatchObject({
      onlyBuddies: false,
      onlyRegistered: false,
    });
  });

  it('restores the last picked preset even when the fields were customised', () => {
    const ctx = { gametypeMap: {}, isRegistered: true };
    writeCreateGameDefaults(true, { ...defaultCreateGameForm(true), maxPlayers: 4, startingLifeTotal: 30 }, {}, 'commanderPod');
    const stored = readCreateGameDefaults();
    expect(initialPresetId(stored, initialCreateGameForm(stored, ctx), ctx)).toBe('commanderPod');
  });

  it('falls back to the matching preset when the remembered one is unavailable or unknown', () => {
    writeCreateGameDefaults(true, defaultCreateGameForm(false), {}, 'friendsOnly');
    const ctx = { gametypeMap: {}, isRegistered: false };
    const stored = readCreateGameDefaults();
    expect(initialPresetId(stored, initialCreateGameForm(stored, ctx), ctx)).toBe('oneVsOne');
    window.localStorage.setItem(CREATE_GAME_DEFAULTS_KEY, JSON.stringify({ remember: true, presetId: 'bogus' }));
    expect(readCreateGameDefaults().presetId).toBeNull();
  });

  it('keeps the remembered fields of the retired Casual preset and picks no preset for them', () => {
    const casualFields = {
      description: 'Open table',
      maxPlayers: 4,
      startingLifeTotal: 20,
      onlyBuddies: false,
      onlyRegistered: false,
      spectatorsAllowed: true,
      spectatorsNeedPassword: false,
      spectatorsCanTalk: true,
      spectatorsSeeEverything: false,
      joinAsSpectator: false,
      shareDecklistsOnLoad: false,
    };
    window.localStorage.setItem(
      CREATE_GAME_DEFAULTS_KEY,
      JSON.stringify({ remember: true, presetId: 'casualOpen', gameTypeName: null, fields: casualFields }),
    );
    const ctx = { gametypeMap: {}, isRegistered: true };
    const stored = readCreateGameDefaults();
    expect(stored.presetId).toBeNull();
    const form = initialCreateGameForm(stored, ctx);
    expect(form).toMatchObject(casualFields);
    expect(initialPresetId(stored, form, ctx)).toBeNull();
  });

  it('a retired Casual default whose fields match a current preset opens on that preset', () => {
    window.localStorage.setItem(
      CREATE_GAME_DEFAULTS_KEY,
      JSON.stringify({ remember: true, presetId: 'casualOpen', fields: defaultCreateGameForm(true) }),
    );
    const ctx = { gametypeMap: {}, isRegistered: true };
    const stored = readCreateGameDefaults();
    expect(initialPresetId(stored, initialCreateGameForm(stored, ctx), ctx)).toBe('oneVsOne');
  });
});
