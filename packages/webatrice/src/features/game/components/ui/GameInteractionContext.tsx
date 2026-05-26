import { createContext, useContext } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

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

const GameInteractionContext = createContext<GameInteractionHandlers | null>(null);

export const GameInteractionProvider = GameInteractionContext.Provider;

export function useGameInteraction(): GameInteractionHandlers {
  const ctx = useContext(GameInteractionContext);
  if (!ctx) {
    throw new Error('useGameInteraction must be used inside <GameInteractionProvider>');
  }
  return ctx;
}
