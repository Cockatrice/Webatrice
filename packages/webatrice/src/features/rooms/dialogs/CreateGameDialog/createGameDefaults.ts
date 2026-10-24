import {
  defaultCreateGameForm,
  findGameTypeByName,
  findPreset,
  isPresetAvailable,
  isPresetId,
  matchingPreset,
  type CreateGameForm,
  type PresetId,
} from './createGamePresets';

export const CREATE_GAME_DEFAULTS_KEY = 'createGame:defaults';

type RememberedFields = Omit<CreateGameForm, 'password' | 'joinAsJudge' | 'gameTypeId'>;

export interface StoredCreateGameDefaults {
  remember: boolean;
  fields?: RememberedFields;
  gameTypeName?: string | null;
  presetId?: PresetId | null;
}

const BOOLEAN_FIELDS = [
  'onlyBuddies',
  'onlyRegistered',
  'spectatorsAllowed',
  'spectatorsNeedPassword',
  'spectatorsCanTalk',
  'spectatorsSeeEverything',
  'joinAsSpectator',
  'shareDecklistsOnLoad',
] as const;

function parseFields(raw: unknown): RememberedFields | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (
    typeof value.description !== 'string' ||
    typeof value.maxPlayers !== 'number' ||
    typeof value.startingLifeTotal !== 'number' ||
    BOOLEAN_FIELDS.some((key) => typeof value[key] !== 'boolean')
  ) {
    return undefined;
  }
  return {
    description: value.description,
    maxPlayers: value.maxPlayers,
    startingLifeTotal: value.startingLifeTotal,
    onlyBuddies: value.onlyBuddies as boolean,
    onlyRegistered: value.onlyRegistered as boolean,
    spectatorsAllowed: value.spectatorsAllowed as boolean,
    spectatorsNeedPassword: value.spectatorsNeedPassword as boolean,
    spectatorsCanTalk: value.spectatorsCanTalk as boolean,
    spectatorsSeeEverything: value.spectatorsSeeEverything as boolean,
    joinAsSpectator: value.joinAsSpectator as boolean,
    shareDecklistsOnLoad: value.shareDecklistsOnLoad as boolean,
  };
}

export function readCreateGameDefaults(): StoredCreateGameDefaults {
  try {
    const raw = window.localStorage.getItem(CREATE_GAME_DEFAULTS_KEY);
    if (!raw) {
      return { remember: true };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      remember: parsed.remember !== false,
      fields: parseFields(parsed.fields),
      gameTypeName: typeof parsed.gameTypeName === 'string' ? parsed.gameTypeName : null,
      presetId: isPresetId(parsed.presetId) ? parsed.presetId : null,
    };
  } catch {
    return { remember: true };
  }
}

export function writeCreateGameDefaults(
  remember: boolean,
  form: CreateGameForm,
  gametypeMap: Record<number, string>,
  presetId: PresetId | null,
): void {
  const stored: StoredCreateGameDefaults = remember
    ? {
      remember,
      fields: {
        description: form.description,
        maxPlayers: form.maxPlayers,
        startingLifeTotal: form.startingLifeTotal,
        onlyBuddies: form.onlyBuddies,
        onlyRegistered: form.onlyRegistered,
        spectatorsAllowed: form.spectatorsAllowed,
        spectatorsNeedPassword: form.spectatorsNeedPassword,
        spectatorsCanTalk: form.spectatorsCanTalk,
        spectatorsSeeEverything: form.spectatorsSeeEverything,
        joinAsSpectator: form.joinAsSpectator,
        shareDecklistsOnLoad: form.shareDecklistsOnLoad,
      },
      gameTypeName: form.gameTypeId != null ? (gametypeMap[form.gameTypeId] ?? null) : null,
      presetId,
    }
    : { remember };
  try {
    window.localStorage.setItem(CREATE_GAME_DEFAULTS_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
}

export function initialCreateGameForm(
  stored: StoredCreateGameDefaults,
  ctx: { gametypeMap: Record<number, string>; isRegistered: boolean },
): CreateGameForm {
  const base = defaultCreateGameForm(ctx.isRegistered);
  if (!stored.remember || !stored.fields) {
    return base;
  }
  const form: CreateGameForm = {
    ...base,
    ...stored.fields,
    gameTypeId: findGameTypeByName(ctx.gametypeMap, stored.gameTypeName ?? null),
  };
  if (!ctx.isRegistered) {
    form.onlyBuddies = false;
    form.onlyRegistered = false;
  }
  return form;
}

export function initialPresetId(
  stored: StoredCreateGameDefaults,
  form: CreateGameForm,
  ctx: { gametypeMap: Record<number, string>; isRegistered: boolean },
): PresetId | null {
  const remembered = stored.remember ? findPreset(stored.presetId) : undefined;
  if (remembered && isPresetAvailable(remembered, ctx.isRegistered)) {
    return remembered.id;
  }
  return matchingPreset(form, ctx);
}
