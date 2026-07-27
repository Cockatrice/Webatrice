import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Tracks the most recently hovered card across all PlayerBoxes so the
 * right-rail preview can show it. Card components set on mouse-enter,
 * consumers (BattlefieldSidebar's CardPreview slot) read it to render
 * a large preview.
 *
 * We track the scryfall id (not just the name) so the preview shows the
 * exact printing the deck chose, not Scryfall's default printing for
 * that card name.
 *
 * Ported from fancy webatrice. Og already has a CardPreviewContext with
 * a different shape used by the existing sidebar CardPreview component;
 * this new context lives alongside it and drives the new PlayerBox
 * Card component. Once the whole PlayerBox port lands, the two will
 * converge in a follow-up wiring step.
 */
export interface HoveredCard {
  name: string;
  scryfallId?: string;
}

interface HoveredCardContextValue {
  hoveredCard: HoveredCard | null;
  setHoveredCard: (card: HoveredCard | null) => void;
}

const HoveredCardContext = createContext<HoveredCardContextValue | null>(null);

export function HoveredCardProvider({ children }: { children: ReactNode }) {
  const [hoveredCard, setHoveredCard] = useState<HoveredCard | null>(null);
  return (
    <HoveredCardContext.Provider value={{ hoveredCard, setHoveredCard }}>
      {children}
    </HoveredCardContext.Provider>
  );
}

/**
 * Read/write the hovered card. Returns a no-op setter when called
 * outside the provider so isolated component previews don't crash.
 */
export function useHoveredCard(): HoveredCardContextValue {
  return (
    useContext(HoveredCardContext) ?? {
      hoveredCard: null,
      setHoveredCard: () => {},
    }
  );
}
