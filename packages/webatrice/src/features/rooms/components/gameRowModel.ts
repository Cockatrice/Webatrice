import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';

import type { Availability } from '@app/components';

export type JoinBlock = 'pending' | 'started' | 'full';
export type SpectateBlock = 'pending' | 'notAllowed';

export interface RowJoinState {
  canJoin: boolean;
  joinBlock: JoinBlock | null;
  canSpectate: boolean;
  spectateBlock: SpectateBlock | null;
  joinNeedsPassword: boolean;
  spectateNeedsPassword: boolean;
}

export interface RowJoinContext {
  override: boolean;
  pending: boolean;
  alreadyJoined: boolean;
}

export type RestrictionKey = 'buddiesOnly' | 'registeredOnly' | 'openDecklists';

export type AgeLabel = { unit: 'new' } | { unit: 'minutes'; count: number } | { unit: 'hours'; count: number };

export function gameAvailability(info: ServerInfo_Game): Availability {
  if (info.started) {
    return 'started';
  }
  if (info.playerCount >= info.maxPlayers) {
    return 'full';
  }
  if (info.withPassword) {
    return 'password';
  }
  if (info.onlyBuddies) {
    return 'buddies';
  }
  return 'open';
}

function joinBlock(info: ServerInfo_Game, { override, pending, alreadyJoined }: RowJoinContext): JoinBlock | null {
  if (pending) {
    return 'pending';
  }
  if (alreadyJoined || override) {
    return null;
  }
  if (info.started) {
    return 'started';
  }
  if (info.playerCount >= info.maxPlayers) {
    return 'full';
  }
  return null;
}

function spectateBlock(info: ServerInfo_Game, { override, pending, alreadyJoined }: RowJoinContext): SpectateBlock | null {
  if (pending) {
    return 'pending';
  }
  if (alreadyJoined || override || info.spectatorsAllowed) {
    return null;
  }
  return 'notAllowed';
}

export function rowJoinState(info: ServerInfo_Game, ctx: RowJoinContext): RowJoinState {
  const join = joinBlock(info, ctx);
  const spectate = spectateBlock(info, ctx);
  const asksPassword = !ctx.override && !ctx.alreadyJoined;
  return {
    canJoin: join === null,
    joinBlock: join,
    canSpectate: spectate === null,
    spectateBlock: spectate,
    joinNeedsPassword: asksPassword && info.withPassword,
    spectateNeedsPassword: asksPassword && info.withPassword && info.spectatorsNeedPassword,
  };
}

export function restrictionKeys(info: ServerInfo_Game): RestrictionKey[] {
  const keys: RestrictionKey[] = [];
  if (info.onlyBuddies) {
    keys.push('buddiesOnly');
  }
  if (info.onlyRegistered) {
    keys.push('registeredOnly');
  }
  if (info.shareDecklistsOnLoad) {
    keys.push('openDecklists');
  }
  return keys;
}

export function gameAge(startTime: number, nowSeconds: number): AgeLabel {
  const minutes = Math.floor(Math.max(0, nowSeconds - startTime) / 60);
  if (minutes < 1) {
    return { unit: 'new' };
  }
  if (minutes < 60) {
    return { unit: 'minutes', count: minutes };
  }
  return { unit: 'hours', count: Math.floor(minutes / 60) };
}

export function gameTypeNames(info: ServerInfo_Game, gametypeMap: Record<number, string>): string[] {
  return [...new Set(info.gameTypes)].map((id) => gametypeMap[id]).filter((name): name is string => Boolean(name));
}
