import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

import { createRequiredContext } from './createRequiredContext';

export interface GameInteractionHandlers {
  onCardHover: (card: ServerInfo_Card) => void;
  onCardFocus: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardBlur: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardClick: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onZoneClick: (playerId: number, zoneName: string) => void;
  onZoneContextMenu: (playerId: number, zoneName: string, event: React.MouseEvent) => void;
}

export const [GameInteractionProvider, useGameInteraction] =
  createRequiredContext<GameInteractionHandlers>('GameInteractionContext');
