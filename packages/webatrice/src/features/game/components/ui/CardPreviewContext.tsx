import { createContext, useContext } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

// The card currently shown in the preview pane. Set in Game (via the
// onCardHover interaction handler) and read by CardPreview — provided through
// context so RightPanel doesn't forward it (it never used it itself).
const CardPreviewContext = createContext<ServerInfo_Card | null>(null);

export const CardPreviewProvider = CardPreviewContext.Provider;

export function useCardPreview(): ServerInfo_Card | null {
  return useContext(CardPreviewContext);
}
