import type { TFunction } from 'i18next';

import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';

export function formatRestrictions(t: TFunction, info: ServerInfo_Game): string {
  const parts: string[] = [];
  if (info.withPassword) {
    parts.push(t('GameInfo.restriction.password'));
  }
  if (info.onlyBuddies) {
    parts.push(t('GameInfo.restriction.buddiesOnly'));
  }
  if (info.onlyRegistered) {
    parts.push(t('GameInfo.restriction.registeredOnly'));
  }
  if (info.shareDecklistsOnLoad) {
    parts.push(t('GameInfo.restriction.openDecklists'));
  }
  return parts.join(', ');
}

export function formatSpectators(t: TFunction, info: ServerInfo_Game): string {
  if (!info.spectatorsAllowed) {
    return t('GameInfo.spectators.notAllowed');
  }
  const count = info.spectatorsCount;
  if (info.spectatorsCanChat && info.spectatorsOmniscient) {
    return t('GameInfo.spectators.withChatAndHands', { count });
  }
  if (info.spectatorsCanChat) {
    return t('GameInfo.spectators.withChat', { count });
  }
  if (info.spectatorsOmniscient) {
    return t('GameInfo.spectators.withHands', { count });
  }
  return String(count);
}
