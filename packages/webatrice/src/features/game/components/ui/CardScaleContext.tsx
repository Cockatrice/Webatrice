import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

import { CARD_SCALE_MAX, CARD_SCALE_MIN, fitCardScale } from './seatFit';

/**
 * Card-scale multiplier — everything sized by a card (cards themselves,
 * library/graveyard/exile boxes, commander stack, battlefield grid) scales
 * with this value. Non-card UI (mana pips, life total, sidebar preview,
 * tabs, header) is unaffected because it doesn't reference the
 * `--card-width` / `--card-height` CSS vars this provider sets.
 *
 * Ports Cockatrice desktop's `GameView::updateSceneRect` behavior (see
 * game_view.cpp:100-103): the desktop client keeps card dimensions
 * constant in scene coords (72×102 in card_dimensions.h) and calls
 * `fitInView(sceneRect, Qt::KeepAspectRatio)` on every widget resize, so
 * the whole scene grows and shrinks with the viewport. We mimic that by
 * measuring the game board container and picking the largest scale at
 * which a seat's battlefield and info column fit its row (seatFit.ts).
 */

const BASE_CARD_WIDTH_PX = 72;
const BASE_CARD_HEIGHT_PX = 102;

export { CARD_SCALE_MAX, CARD_SCALE_MIN };
export const CARD_SCALE_DEFAULT = 1;

type CardScaleContextValue = {
  scale: number;
};

const CardScaleContext = createContext<CardScaleContextValue>({
  scale: CARD_SCALE_DEFAULT,
});

export function computeScale(height: number, rows: number, inlineHand = false): number {
  if (height <= 0) {
    return CARD_SCALE_DEFAULT;
  }
  return fitCardScale(height / Math.max(1, rows), { inlineHand });
}

export interface CardScaleProviderProps {
  /** Container whose bounding rect drives the scale. Typically the game
   *  board's play area. When absent (or unmounted) the provider falls
   *  back to the default 1.0 scale — safe for isolated component
   *  previews and tests. */
  containerRef?: RefObject<HTMLElement | null>;
  rows?: number;
  inlineHand?: boolean;
  children: ReactNode;
}

export function CardScaleProvider({
  containerRef,
  rows = 1,
  inlineHand = false,
  children,
}: CardScaleProviderProps) {
  const [scale, setScale] = useState<number>(CARD_SCALE_DEFAULT);

  // useLayoutEffect so the initial measurement happens before paint — a
  // useEffect would produce one frame at the default scale followed by
  // a jump, visible as a card-size pop on mount.
  useLayoutEffect(() => {
    const el = containerRef?.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setScale(computeScale(rect.height, rows, inlineHand));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, rows, inlineHand]);

  // Root-font-size changes (browser text-zoom) don't fire ResizeObserver
  // on the board — the CSS-computed rem baseline changes but the pixel
  // rect stays the same. Listen for it explicitly so a user zoom still
  // re-syncs the layout math.
  useEffect(() => {
    const onFontChange = () => {
      const el = containerRef?.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      setScale(computeScale(rect.height, rows, inlineHand));
    };
    window.addEventListener('resize', onFontChange);
    return () => window.removeEventListener('resize', onFontChange);
  }, [containerRef, rows, inlineHand]);

  // Apply the CSS vars at the document root so descendants inherit them
  // even when they portal out of the React tree (drag ghost, dialogs,
  // context menus, and the card context modal all render into
  // document.body). Cleanup on unmount restores the fallback values in
  // cardSize.ts so a Game unmount doesn't leave orphan vars on :root.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--card-width', `${BASE_CARD_WIDTH_PX * scale}px`);
    root.style.setProperty('--card-height', `${BASE_CARD_HEIGHT_PX * scale}px`);
    // Gap + stack offset stay proportional to card size; the base values
    // (18 / 13.5) preserve the previous 20 / 15 gap-to-card ratio now
    // that the base card is 72 wide instead of 80.
    root.style.setProperty('--card-gap-px', `${18 * scale}px`);
    root.style.setProperty('--card-stack-offset-px', `${13.5 * scale}px`);
    return () => {
      root.style.removeProperty('--card-width');
      root.style.removeProperty('--card-height');
      root.style.removeProperty('--card-gap-px');
      root.style.removeProperty('--card-stack-offset-px');
    };
  }, [scale]);

  const value = useMemo(() => ({ scale }), [scale]);

  return (
    <CardScaleContext.Provider value={value}>
      {children}
    </CardScaleContext.Provider>
  );
}

export function useCardScale(): CardScaleContextValue {
  return useContext(CardScaleContext);
}

/**
 * The CSS-variable style object to apply at the game-area root. Every
 * card-sized element in the game view reads these variables (via the
 * `CARD_WIDTH` / `CARD_HEIGHT` constants in cardSize.ts) so a single
 * scale change reflows the whole card layout in one paint.
 *
 * The `.game` root wraps the play area AND the sidebar; the CSS vars
 * cascade to card-sized descendants only, and non-card UI ignores them.
 */
export function cardScaleVars(scale: number): CSSProperties {
  return {
    '--card-width': `${BASE_CARD_WIDTH_PX * scale}px`,
    '--card-height': `${BASE_CARD_HEIGHT_PX * scale}px`,
    '--card-gap-px': `${18 * scale}px`,
    '--card-stack-offset-px': `${13.5 * scale}px`,
  } as CSSProperties;
}

export function SeatCardScaleProvider({ scale, children }: { scale: number; children: ReactNode }) {
  const value = useMemo(() => ({ scale }), [scale]);
  return <CardScaleContext.Provider value={value}>{children}</CardScaleContext.Provider>;
}

export function useCardScaleStyle(): CSSProperties {
  const { scale } = useCardScale();
  return useMemo(() => cardScaleVars(scale), [scale]);
}
