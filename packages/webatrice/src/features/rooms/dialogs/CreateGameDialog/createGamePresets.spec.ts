import {
  CREATE_GAME_PRESETS,
  applyPreset,
  defaultCreateGameForm,
  findCommanderGameType,
  findOtherGameType,
  invalidCreateGameField,
  matchingPreset,
  summarizeCreateGame,
  toCreateGameParams,
  type PresetId,
} from './createGamePresets';

const presetById = (id: PresetId) => CREATE_GAME_PRESETS.find((p) => p.id === id)!;

describe('findCommanderGameType', () => {
  it('prefers an exact Commander or EDH name, case-insensitive', () => {
    expect(findCommanderGameType({ 1: 'Commander Legends draft', 2: 'commander' })).toBe(2);
    expect(findCommanderGameType({ 4: 'EDH' })).toBe(4);
  });

  it('falls back to a name containing the word', () => {
    expect(findCommanderGameType({ 1: 'Standard', 5: 'Commander (EDH)' })).toBe(5);
  });

  it('does not match cEDH-like names or an empty list', () => {
    expect(findCommanderGameType({ 1: 'cEDH' })).toBeNull();
    expect(findCommanderGameType({})).toBeNull();
  });
});

describe('findOtherGameType', () => {
  it('finds the room\'s Other type by name, case-insensitive', () => {
    expect(findOtherGameType({ 1: 'Standard', 6: ' other ' })).toBe(6);
  });

  it('returns null when the room has no Other type', () => {
    expect(findOtherGameType({ 1: 'Standard', 2: 'Other formats' })).toBeNull();
    expect(findOtherGameType({})).toBeNull();
  });
});

describe('CREATE_GAME_PRESETS', () => {
  it('offers Commander pod, Competitive 1v1, Friends only and Duel Commander, in that order', () => {
    expect(CREATE_GAME_PRESETS.map((p) => p.id)).toEqual(['commanderPod', 'oneVsOne', 'friendsOnly', 'duelCommander']);
  });

  it('Duel Commander is Competitive 1v1 with 30 life and the Other format', () => {
    const ctx = { gametypeMap: { 4: 'Modern', 8: 'Other' }, isRegistered: true };
    const base = { ...defaultCreateGameForm(true), gameTypeId: 4 };
    const oneVsOne = applyPreset(base, presetById('oneVsOne'), ctx);
    const duel = applyPreset(base, presetById('duelCommander'), ctx);
    expect(duel).toEqual({ ...oneVsOne, startingLifeTotal: 30, gameTypeId: 8 });
  });
});

describe('applyPreset', () => {
  const registered = { gametypeMap: { 3: 'Commander', 4: 'Modern' }, isRegistered: true };

  it('sets the Commander type only when the room has one', () => {
    const base = { ...defaultCreateGameForm(true), gameTypeId: 4 };
    expect(applyPreset(base, presetById('commanderPod'), registered).gameTypeId).toBe(3);
    expect(applyPreset(base, presetById('commanderPod'), { ...registered, gametypeMap: { 4: 'Modern' } }).gameTypeId).toBeNull();
  });

  it('keeps the description, password and format where the preset does not own them', () => {
    const base = { ...defaultCreateGameForm(true), description: 'Pod', password: 'pw', gameTypeId: 4 };
    const next = applyPreset(base, presetById('friendsOnly'), registered);
    expect(next).toMatchObject({ description: 'Pod', password: 'pw', gameTypeId: 4, onlyBuddies: true, spectatorsAllowed: false });
  });

  it('never restricts a guest\'s game to registered players or buddies', () => {
    const next = applyPreset(defaultCreateGameForm(false), presetById('commanderPod'), { ...registered, isRegistered: false });
    expect(next.onlyRegistered).toBe(false);
    expect(next.onlyBuddies).toBe(false);
  });
});

describe('matchingPreset', () => {
  const reg = { gametypeMap: {}, isRegistered: true };

  it('matches the desktop defaults to 1v1', () => {
    expect(matchingPreset(defaultCreateGameForm(true), reg)).toBe('oneVsOne');
    expect(matchingPreset(defaultCreateGameForm(false), { gametypeMap: {}, isRegistered: false })).toBe('oneVsOne');
  });

  it('matches each preset after it is applied', () => {
    const ctx = { gametypeMap: {}, isRegistered: true };
    for (const preset of CREATE_GAME_PRESETS) {
      expect(matchingPreset(applyPreset(defaultCreateGameForm(true), preset, ctx), ctx)).toBe(preset.id);
    }
  });

  it('returns null once a preset field is changed', () => {
    expect(matchingPreset({ ...defaultCreateGameForm(true), maxPlayers: 3 }, reg)).toBeNull();
  });
});

describe('matchingPreset with formats', () => {
  const ctx = { gametypeMap: { 3: 'Commander', 4: 'Modern' }, isRegistered: true };

  it('stops matching Commander pod once another format is chosen', () => {
    const pod = applyPreset(defaultCreateGameForm(true), presetById('commanderPod'), ctx);
    expect(matchingPreset(pod, ctx)).toBe('commanderPod');
    expect(matchingPreset({ ...pod, gameTypeId: 4 }, ctx)).toBeNull();
  });

  it('requires Any for the 1v1 preset', () => {
    expect(matchingPreset({ ...defaultCreateGameForm(true), gameTypeId: 4 }, ctx)).toBeNull();
  });
});

describe('invalidCreateGameField', () => {
  it('accepts whole numbers in range and rejects the rest', () => {
    const base = defaultCreateGameForm(true);
    expect(invalidCreateGameField(base)).toBeNull();
    expect(invalidCreateGameField({ ...base, maxPlayers: 0 })).toBe('maxPlayers');
    expect(invalidCreateGameField({ ...base, maxPlayers: 101 })).toBe('maxPlayers');
    expect(invalidCreateGameField({ ...base, maxPlayers: 2.5 })).toBe('maxPlayers');
    expect(invalidCreateGameField({ ...base, startingLifeTotal: 0 })).toBe('startingLifeTotal');
    expect(invalidCreateGameField({ ...base, startingLifeTotal: Number.NaN })).toBe('startingLifeTotal');
  });
});

describe('toCreateGameParams', () => {
  it('drops spectator sub-options when spectators are off and judge for non-judges', () => {
    const form = {
      ...defaultCreateGameForm(true),
      spectatorsAllowed: false,
      spectatorsCanTalk: true,
      spectatorsNeedPassword: true,
      spectatorsSeeEverything: true,
      joinAsJudge: true,
      gameTypeId: 2,
    };
    expect(toCreateGameParams(form, false)).toMatchObject({
      spectatorsCanTalk: false,
      spectatorsNeedPassword: false,
      spectatorsSeeEverything: false,
      joinAsJudge: false,
      gameTypeIds: [2],
    });
    expect(toCreateGameParams(form, true).joinAsJudge).toBe(true);
  });
});

describe('summarizeCreateGame', () => {
  it('describes who can join, the format and the watchers', () => {
    const form = { ...defaultCreateGameForm(true), onlyBuddies: true, password: 'x', gameTypeId: 3, spectatorsAllowed: false };
    expect(summarizeCreateGame(form, { gametypeMap: { 3: 'Commander' }, isJudge: false })).toMatchObject({
      audience: 'buddies',
      hasPassword: true,
      format: 'Commander',
      spectators: null,
    });
    expect(summarizeCreateGame(defaultCreateGameForm(false), { gametypeMap: {}, isJudge: false }).audience).toBe('anyone');
  });
});
