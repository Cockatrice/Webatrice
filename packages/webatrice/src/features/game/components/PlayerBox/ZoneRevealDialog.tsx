import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Card from "./Card";
import { CARD_HEIGHT, CARD_WIDTH } from "./cardSize";

type HandCard = { id: string; name: string; scryfallId: string };

/**
 * Generic modal for viewing a zone's card list (library, graveyard,
 * exile, sideboard, etc.). Ports Cockatrice's ZoneViewWidget behavior
 * for the bounded-reveal path:
 *   • Cards render in the zone's server order — NO sort or group
 *     controls (Cockatrice deliberately keeps this a flat, ordered
 *     window so tutors / scries / rearranges preserve intent).
 *   • Cards can be dragged out to any play-area zone (parent wires
 *     `onCardPointerDown` into its normal beginDrag flow), and drops
 *     landing back on the dialog resolve to the source zone via
 *     `dropRef`. Both patterns match LibrarySearchDialog.
 *   • The dialog itself is draggable via the header, resizable via
 *     the browser's native `resize` handle, and non-modal (no blurred
 *     backdrop) so the play area behind stays visible and interactive.
 *   • Position + size persist to localStorage across sessions.
 *
 * Reused by "View top / bottom cards of library...", and (eventually)
 * "View graveyard" / "View exile" variants — zone-specific bits
 * (title, wire source zone, drag wiring) live in the caller.
 */
export interface ZoneRevealDialogProps {
  isOpen: boolean;
  /** Human-readable title for the modal header. Caller composes
   *  something like "Top 5 cards — SonicBliss" or "Graveyard — SonicBliss". */
  title: string;
  /** Optional hint under the title (e.g. "top of library is leftmost").
   *  Omit for zones where the hint doesn't apply. */
  subtitle?: string;
  cards: readonly HandCard[];
  /** Per-card label rendered below each slot — one string per entry in
   *  `cards`, same order. Omit to render no labels. */
  labels?: readonly string[];
  /** Fired on pointerdown of a card. Parent wires this into its normal
   *  beginDrag flow so the card can be dragged to any zone in the play
   *  area. When the drop lands back on the dialog itself (see
   *  `dropRef`), the parent should resolve it as a same-zone move. */
  onCardPointerDown?: (
    e: ReactPointerEvent<HTMLElement>,
    card: HandCard,
  ) => void;
  /** Ref filled with the dialog's outer container while open. Parent's
   *  drop-detection can hit-test this rect to decide whether a drop
   *  resolves to the dialog's source zone. Same pattern LibrarySearchDialog
   *  uses via its `dropRef`. */
  dropRef?: RefObject<HTMLDivElement | null>;
  /** IDs of cards currently mid-drag from the dialog. Rendered at
   *  opacity 0 so the drag ghost is the only visible copy. */
  draggingCardIds?: Set<string>;
  /** Called when the dialog closes (X button, Escape, or footer Close). */
  onClose: () => void;
}

/** localStorage keys — shared across ALL zone-reveal invocations so the
 *  user's remembered position/size applies whether they're viewing the
 *  library, graveyard, or exile. */
const POSITION_STORAGE_KEY = "webatrice.zoneRevealPosition";
const SIZE_STORAGE_KEY = "webatrice.zoneRevealSize";

const MIN_DIALOG_W = 400;
const MIN_DIALOG_H = 240;
const DEFAULT_DIALOG_W = 900;
const DEFAULT_DIALOG_H = 480;

function readStoredPosition(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredPosition(pos: { x: number; y: number }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function readStoredSize(): { w: number; h: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.w === "number" &&
      typeof parsed.h === "number" &&
      Number.isFinite(parsed.w) &&
      Number.isFinite(parsed.h)
    ) {
      return { w: parsed.w, h: parsed.h };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredSize(size: { w: number; h: number }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    // ignore
  }
}

function clampToViewport(
  pos: { x: number; y: number },
  size: { w: number; h: number },
): { x: number; y: number } {
  if (typeof window === "undefined") return pos;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, vw - size.w)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, vh - size.h)),
  };
}

function clampSizeToViewport(size: { w: number; h: number }): {
  w: number;
  h: number;
} {
  if (typeof window === "undefined") return size;
  return {
    w: Math.min(Math.max(MIN_DIALOG_W, size.w), window.innerWidth),
    h: Math.min(Math.max(MIN_DIALOG_H, size.h), window.innerHeight),
  };
}

export default function ZoneRevealDialog({
  isOpen,
  title,
  subtitle,
  cards,
  labels,
  onCardPointerDown,
  dropRef,
  draggingCardIds,
  onClose,
}: ZoneRevealDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Position — `null` until the layout effect measures the dialog and
  // either restores a saved position or centers it. Once set, the
  // dialog is absolutely positioned (draggable via the header).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const hasBeenDraggedRef = useRef(false);

  // Apply saved size before the position layout effect runs, so the
  // position calc uses the final rendered size. Written imperatively
  // so the native `resize: both` handle can freely change the inline
  // width/height without racing React state.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;
    const storedSize = readStoredSize();
    if (storedSize) {
      const clamped = clampSizeToViewport(storedSize);
      el.style.width = `${clamped.w}px`;
      el.style.height = `${clamped.h}px`;
    } else {
      el.style.width = `${DEFAULT_DIALOG_W}px`;
      el.style.height = `${DEFAULT_DIALOG_H}px`;
    }
  }, [isOpen]);

  // Position on open — restore saved location or center. useLayoutEffect
  // so the paint of the positioned dialog lands on the same frame as the
  // flex-centered fallback — no visible jump.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const stored = readStoredPosition();
    if (stored) {
      setPos(clampToViewport(stored, { w: rect.width, h: rect.height }));
    } else {
      setPos({
        x: Math.max(0, (window.innerWidth - rect.width) / 2),
        y: Math.max(0, (window.innerHeight - rect.height) / 2),
      });
    }
  }, [isOpen]);

  // Persist size after 500ms of no change. First ResizeObserver fire
  // is skipped — it reports the initial size (from storage or CSS
  // default), which the user hasn't actively set. Any subsequent fire
  // means the user grabbed the resize handle.
  useEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;
    let first = true;
    let timer: number | null = null;
    const ro = new ResizeObserver(([entry]) => {
      if (first) {
        first = false;
        return;
      }
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        writeStoredSize({ w, h });
      }, 500);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isOpen]);

  // Global pointer listeners while dragging the header.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const off = dragOffset.current;
      if (!off) return;
      setPos({ x: e.clientX - off.x, y: e.clientY - off.y });
    };
    const onUp = () => {
      dragOffset.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  // Persist position 500ms after last move (skipped on first open).
  useEffect(() => {
    if (!isOpen || !pos || !hasBeenDraggedRef.current) return;
    const timer = window.setTimeout(() => {
      writeStoredPosition(pos);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isOpen, pos]);

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Don't start a drag from the close button (or any other button
    // that might land in the header later).
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    hasBeenDraggedRef.current = true;
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    // The outer wrapper is pointer-events: none so clicks pass through
    // to the game behind — the dialog itself is the only interactive
    // region. Matches LibrarySearchDialog's non-modal behavior.
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 pointer-events-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={(el) => {
          dialogRef.current = el;
          if (dropRef) dropRef.current = el;
        }}
        className="bg-bg-surface border border-border-subtle rounded-lg shadow-glow flex flex-col pointer-events-auto resize overflow-hidden"
        style={{
          minWidth: `${MIN_DIALOG_W}px`,
          minHeight: `${MIN_DIALOG_H}px`,
          ...(pos
            ? { position: "absolute", left: pos.x, top: pos.y, margin: 0 }
            : null),
        }}
      >
        {/* Header — grab handle for dragging the dialog. */}
        <div
          onPointerDown={onHeaderPointerDown}
          className={[
            "px-4 py-3 border-b border-border-subtle flex items-center gap-2 shrink-0 select-none",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
        >
          <div className="min-w-0 flex-1">
            <h2 className="font-modern text-base font-semibold text-text-primary truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cards row — wraps when the reveal is wider than the modal. */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {cards.length === 0 ? (
            <div className="text-sm text-text-muted italic">
              No cards to show.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {cards.map((c, i) => {
                const label = labels?.[i];
                const isDragging = draggingCardIds?.has(c.id);
                return (
                  <div
                    key={`${c.id}-${i}`}
                    className="flex flex-col items-center gap-1"
                    style={{ width: CARD_WIDTH }}
                  >
                    <div
                      data-card
                      data-card-id={c.id}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        onCardPointerDown?.(e, c);
                      }}
                      style={{
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        cursor: onCardPointerDown ? "grab" : "default",
                        opacity: isDragging ? 0 : 1,
                        touchAction: onCardPointerDown ? "none" : undefined,
                        borderRadius: "7.5%",
                        transition: "opacity 100ms ease-out",
                      }}
                    >
                      <Card name={c.name} scryfallId={c.scryfallId} />
                    </div>
                    {label != null && (
                      <span className="text-xs font-semibold text-text-secondary tabular-nums select-none">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
