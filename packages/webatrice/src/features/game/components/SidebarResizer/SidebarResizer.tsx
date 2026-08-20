import { useCallback, useEffect, useRef, useState } from 'react';

import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from '../../hooks/useSidebarWidth';

interface SidebarResizerProps {
  /** Current sidebar width in px. Used for the initial anchor when the
   *  user starts dragging so incremental deltas track the pointer. */
  width: number;
  /** Commit a new sidebar width. Caller is responsible for clamping;
   *  useSidebarWidth already does it. */
  onResize: (nextWidth: number) => void;
}

/**
 * 8-px vertical drag handle sitting between the play area and the
 * BattlefieldSidebar. Grabs pointer capture on mousedown so subsequent
 * moves reach us even when the pointer crosses over other elements
 * (dragging past the play-area's edge, over the game board, etc.).
 *
 * Rendered inside the `.game` CSS grid; grid-template-columns includes
 * a fixed slot for the handle right before the sidebar column.
 */
export default function SidebarResizer({ width, onResize }: SidebarResizerProps) {
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Left button only; treat other buttons (context menu, middle) as no-ops.
    if (e.button !== 0) return;
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startWidth: width };
    setDragging(true);
    // Capture pointer so we keep receiving move events even when the
    // pointer strays outside the 8-px handle.
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [width]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    // Right-anchored: dragging left (negative delta) grows the sidebar,
    // dragging right shrinks it. Matches the resizer's visual position.
    const delta = state.startX - e.clientX;
    onResize(state.startWidth + delta);
  }, [onResize]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be gone (element unmounted mid-drag) — ignore.
    }
  }, []);

  // Keyboard nudge: Left / Right arrows resize by 24 px when the handle
  // has focus. Home/End jump to min/max. Preserves keyboard-only access
  // to the layout preference.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const STEP = 24;
    if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(width + STEP); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); onResize(width - STEP); return; }
    if (e.key === 'Home') { e.preventDefault(); onResize(SIDEBAR_WIDTH_MAX); return; }
    if (e.key === 'End') { e.preventDefault(); onResize(SIDEBAR_WIDTH_MIN); return; }
  }, [onResize, width]);

  // While dragging, show a col-resize cursor even when the pointer
  // strays off the 8-px handle. body-level class toggle so the whole
  // page reflects it — matches the feel of native window resizers.
  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={[
        'group h-full w-2 cursor-col-resize select-none',
        'flex items-center justify-center',
        'hover:bg-accent/20 focus:outline-none focus:bg-accent/30',
        dragging ? 'bg-accent/30' : '',
      ].join(' ')}
      title="Drag to resize the sidebar (Arrow keys for keyboard)"
    >
      {/* Thin visual affordance — a 1-px column that lights up on hover.
       *  Kept subtle so the resizer doesn't compete with sidebar content. */}
      <div className="w-px h-8 bg-border-subtle group-hover:bg-accent transition-colors" />
    </div>
  );
}
