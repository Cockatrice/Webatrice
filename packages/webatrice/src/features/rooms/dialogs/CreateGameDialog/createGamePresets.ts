import type { CreateGameParams } from '@cockatrice/sockatrice/generated';

export const DEFAULT_MAX_PLAYERS = 2;
export const DEFAULT_STARTING_LIFE = 20;
export const MAX_PLAYERS_RANGE = { min: 1, max: 100 } as const;
export const STARTING_LIFE_RANGE = { min: 1, max: 99999 } as const;

export interface CreateGameForm {
  description: string;
  password: string;
  maxPlayers: number;
  onlyBuddies: boolean;
  onlyRegistered: boolean;
  spectatorsAllowed: boolean;
  spectatorsNeedPassword: boolean;
  spectatorsCanTalk: boolean;
  spectatorsSeeEverything: boolean;
  joinAsSpectator: boolean;
  startingLifeTotal: number;
  shareDecklistsOnLoad: boolean;
  joinAsJudge: boolean;
  gameTypeId: number | null;
}

export type PresetId = 'commanderPod' | 'oneVsOne' | 'friendsOnly' | 'duelCommander';

type PresetFields = Partial<Omit<CreateGameForm, 'description' | 'password' | 'gameTypeId' | 'joinAsJudge'>>;

export interface CreateGamePreset {
  id: PresetId;
  fields: PresetFields;
  format: 'commander' | 'other' | 'any' | 'keep';
  needsRegistration: boolean;
}

const OPEN_TABLE: PresetFields = {
  onlyRegistered: true,
  onlyBuddies: false,
  spectatorsAllowed: true,
  spectatorsCanTalk: false,
  spectatorsSeeEverything: false,
  shareDecklistsOnLoad: false,
};

export const CREATE_GAME_PRESETS: readonly CreateGamePreset[] = [
  {
    id: 'commanderPod',
    fields: { ...OPEN_TABLE, maxPlayers: 4, startingLifeTotal: 40 },
    format: 'commander',
    needsRegistration: false,
  },
  {
    id: 'oneVsOne',
    fields: { ...OPEN_TABLE, maxPlayers: 2, startingLifeTotal: 20 },
    format: 'any',
    needsRegistration: false,
  },
  {
    id: 'friendsOnly',
    fields: { onlyBuddies: true, spectatorsAllowed: false, spectatorsCanTalk: false },
    format: 'keep',
    needsRegistration: true,
  },
  {
    id: 'duelCommander',
    fields: { ...OPEN_TABLE, maxPlayers: 2, startingLifeTotal: 30 },
    format: 'other',
    needsRegistration: false,
  },
];

export const DEFAULT_PRESET_ID: PresetId = 'oneVsOne';

export function defaultCreateGameForm(isRegistered: boolean): CreateGameForm {
  return {
    description: '',
    password: '',
    maxPlayers: DEFAULT_MAX_PLAYERS,
    onlyBuddies: false,
    onlyRegistered: isRegistered,
    spectatorsAllowed: true,
    spectatorsNeedPassword: false,
    spectatorsCanTalk: false,
    spectatorsSeeEverything: false,
    joinAsSpectator: false,
    startingLifeTotal: DEFAULT_STARTING_LIFE,
    shareDecklistsOnLoad: false,
    joinAsJudge: false,
    gameTypeId: null,
  };
}

const COMMANDER_NAMES = new Set(['commander', 'edh']);
const OTHER_NAME = 'other';

export function findCommanderGameType(gametypeMap: Record<number, string>): number | null {
  const entries = Object.entries(gametypeMap).map(([id, name]) => ({ id: Number(id), name: name.trim().toLowerCase() }));
  const exact = entries.find(({ name }) => COMMANDER_NAMES.has(name));
  if (exact) {
    return exact.id;
  }
  const word = entries.find(({ name }) => name.split(/[^a-z]+/).some((part) => COMMANDER_NAMES.has(part)));
  return word ? word.id : null;
}

export function findOtherGameType(gametypeMap: Record<number, string>): number | null {
  const match = Object.entries(gametypeMap).find(([, name]) => name.trim().toLowerCase() === OTHER_NAME);
  return match ? Number(match[0]) : null;
}

export function findGameTypeByName(gametypeMap: Record<number, string>, name: string | null): number | null {
  if (!name) {
    return null;
  }
  const match = Object.entries(gametypeMap).find(([, typeName]) => typeName === name);
  return match ? Number(match[0]) : null;
}

export function presetFields(preset: CreateGamePreset, isRegistered: boolean): PresetFields {
  if (isRegistered) {
    return preset.fields;
  }
  const fields = { ...preset.fields };
  if (fields.onlyRegistered !== undefined) {
    fields.onlyRegistered = false;
  }
  if (fields.onlyBuddies !== undefined) {
    fields.onlyBuddies = false;
  }
  return fields;
}

export function isPresetAvailable(preset: CreateGamePreset, isRegistered: boolean): boolean {
  return isRegistered || !preset.needsRegistration;
}

type PresetContext = { gametypeMap: Record<number, string>; isRegistered: boolean };

function presetFormat(preset: CreateGamePreset, gametypeMap: Record<number, string>): number | null | undefined {
  if (preset.format === 'commander') {
    return findCommanderGameType(gametypeMap);
  }
  if (preset.format === 'other') {
    return findOtherGameType(gametypeMap);
  }
  return preset.format === 'any' ? null : undefined;
}

export function applyPreset(form: CreateGameForm, preset: CreateGamePreset, ctx: PresetContext): CreateGameForm {
  const next: CreateGameForm = { ...form, ...presetFields(preset, ctx.isRegistered) };
  const format = presetFormat(preset, ctx.gametypeMap);
  if (format !== undefined) {
    next.gameTypeId = format;
  }
  return next;
}

export function presetMatches(form: CreateGameForm, preset: CreateGamePreset, ctx: PresetContext): boolean {
  const format = presetFormat(preset, ctx.gametypeMap);
  return (
    isPresetAvailable(preset, ctx.isRegistered) &&
    (format === undefined || form.gameTypeId === format) &&
    Object.entries(presetFields(preset, ctx.isRegistered)).every(
      ([key, value]) => form[key as keyof PresetFields] === value,
    )
  );
}

export function matchingPreset(form: CreateGameForm, ctx: PresetContext): PresetId | null {
  const match = CREATE_GAME_PRESETS.find((preset) => presetMatches(form, preset, ctx));
  return match ? match.id : null;
}

export function findPreset(id: PresetId | null | undefined): CreateGamePreset | undefined {
  return CREATE_GAME_PRESETS.find((preset) => preset.id === id);
}

export function isPresetId(value: unknown): value is PresetId {
  return CREATE_GAME_PRESETS.some((preset) => preset.id === value);
}

export type InvalidField = 'maxPlayers' | 'startingLifeTotal';

const inRange = (value: number, range: { min: number; max: number }) =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

export function invalidCreateGameField(form: CreateGameForm): InvalidField | null {
  if (!inRange(form.maxPlayers, MAX_PLAYERS_RANGE)) {
    return 'maxPlayers';
  }
  if (!inRange(form.startingLifeTotal, STARTING_LIFE_RANGE)) {
    return 'startingLifeTotal';
  }
  return null;
}

export function toCreateGameParams(form: CreateGameForm, isJudge: boolean): CreateGameParams {
  return {
    description: form.description,
    password: form.password,
    maxPlayers: form.maxPlayers,
    onlyBuddies: form.onlyBuddies,
    onlyRegistered: form.onlyRegistered,
    spectatorsAllowed: form.spectatorsAllowed,
    spectatorsNeedPassword: form.spectatorsAllowed && form.spectatorsNeedPassword,
    spectatorsCanTalk: form.spectatorsAllowed && form.spectatorsCanTalk,
    spectatorsSeeEverything: form.spectatorsAllowed && form.spectatorsSeeEverything,
    gameTypeIds: form.gameTypeId != null ? [form.gameTypeId] : [],
    joinAsJudge: isJudge && form.joinAsJudge,
    joinAsSpectator: form.joinAsSpectator,
    startingLifeTotal: form.startingLifeTotal,
    shareDecklistsOnLoad: form.shareDecklistsOnLoad,
  };
}

export type SummaryAudience = 'buddies' | 'registered' | 'anyone';

export interface CreateGameSummary {
  seats: number;
  audience: SummaryAudience;
  hasPassword: boolean;
  life: number;
  format: string | null;
  spectators: { canTalk: boolean; seeEverything: boolean; needPassword: boolean } | null;
  shareDecklists: boolean;
  hostWatches: boolean;
  hostJudges: boolean;
}

export function summarizeCreateGame(
  form: CreateGameForm,
  ctx: { gametypeMap: Record<number, string>; isJudge: boolean },
): CreateGameSummary {
  return {
    seats: form.maxPlayers,
    audience: form.onlyBuddies ? 'buddies' : form.onlyRegistered ? 'registered' : 'anyone',
    hasPassword: form.password !== '',
    life: form.startingLifeTotal,
    format: form.gameTypeId != null ? (ctx.gametypeMap[form.gameTypeId] ?? null) : null,
    spectators: form.spectatorsAllowed
      ? {
        canTalk: form.spectatorsCanTalk,
        seeEverything: form.spectatorsSeeEverything,
        needPassword: form.spectatorsNeedPassword,
      }
      : null,
    shareDecklists: form.shareDecklistsOnLoad,
    hostWatches: form.joinAsSpectator,
    hostJudges: ctx.isJudge && form.joinAsJudge,
  };
}

export function advancedSettingCount(isJudge: boolean): number {
  return isJudge ? 11 : 10;
}
