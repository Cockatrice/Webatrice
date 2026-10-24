import { PlayerEntry } from '@cockatrice/datatrice';
import type { TFunction } from 'i18next';

export function playerName(player: PlayerEntry, t: TFunction): string {
  return player.properties.userInfo?.name
    ?? t('GameLog.player.number', { id: player.properties.playerId });
}
