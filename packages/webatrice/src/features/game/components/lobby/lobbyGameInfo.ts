import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';

export type LobbyAudience = 'anyone' | 'registered' | 'buddies';

export interface LobbyGameFacts {
  description: string;
  formats: string[] | null;
  seats: { taken: number; max: number };
  audience: LobbyAudience;
  hasPassword: boolean;
  spectators: { canChat: boolean; seeEverything: boolean; needPassword: boolean } | null;
  shareDecklists: boolean;
}

export function lobbyGameFacts(
  info: ServerInfo_Game,
  ctx: { gametypeMap: Record<number, string> | undefined; seated: number },
): LobbyGameFacts {
  const typeIds = [...new Set(info.gameTypes)];
  const names = ctx.gametypeMap
    ? typeIds.map((id) => ctx.gametypeMap?.[id]).filter((name): name is string => Boolean(name))
    : [];
  return {
    description: info.description.trim(),
    formats: typeIds.length === 0 ? [] : names.length > 0 ? names : null,
    seats: { taken: ctx.seated, max: info.maxPlayers || ctx.seated },
    audience: info.onlyBuddies ? 'buddies' : info.onlyRegistered ? 'registered' : 'anyone',
    hasPassword: info.withPassword,
    spectators: info.spectatorsAllowed
      ? {
        canChat: info.spectatorsCanChat,
        seeEverything: info.spectatorsOmniscient,
        needPassword: info.spectatorsNeedPassword,
      }
      : null,
    shareDecklists: info.shareDecklistsOnLoad,
  };
}
