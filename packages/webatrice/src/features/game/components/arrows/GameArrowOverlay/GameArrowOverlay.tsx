import { useId } from 'react';
import { useAnimationPreference } from '@app/hooks';

import { useGameId } from '../../ui/GameIdContext';

import { arrowKey, useGameArrowOverlay } from './useGameArrowOverlay';
import { buildArrowGeometry } from './arrowPath';
import { useArrivingArrows, useArrowDrawIn } from './useArrowDrawIn';

import './GameArrowOverlay.css';

export interface GameArrowOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  layoutVersion?: unknown;
  /** Live drag preview endpoint (viewport → board-relative coords). The
   *  `fullColor` flag mirrors Cockatrice's `ArrowDragItem::fullColor`
   *  (alpha 200 when snapped to a valid target, 150 otherwise). */
  dragPreview?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    fullColor?: boolean;
  } | null;
}

/** Splits a `rgba(...)` string into its rgb triplet and alpha value so
 *  we can rebuild the same color at a different alpha (Cockatrice paints
 *  arrows at α=150 while unlocked, α=200 while a valid target is under
 *  the cursor). Non-rgba() inputs fall through with a default alpha of
 *  200 so a solid color still renders at "targeted" strength. */
function applyAlpha(color: string, alpha: number): string {
  const m = color.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  );
  if (!m) {
    return color;
  }
  const [, r, g, b] = m;
  return `rgba(${r}, ${g}, ${b}, ${(alpha / 255).toFixed(3)})`;
}

/** One rendered arrow — the curved filled path anchored at (originX,
 *  originY) and rotated by angleDeg so local +X points at the target.
 *  `onClick` is only set for committed arrows (drag preview is
 *  pointer-events: none). */
function ArrowShape({
  x1,
  y1,
  x2,
  y2,
  color,
  onClick,
  testId,
  className,
  drawIn,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  onClick?: () => void;
  testId?: string;
  className?: string;
  drawIn?: { id: string; animate: boolean };
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const progress = useArrowDrawIn(drawIn?.animate ?? false, length);
  const geom = buildArrowGeometry(x1, y1, x2, y2);
  if (!geom) {
    return null;
  }
  const clipId = drawIn && progress < 1 ? `arrow-draw-${drawIn.id}` : undefined;
  return (
    <g
      transform={`translate(${geom.originX} ${geom.originY}) rotate(${geom.angleDeg})`}
      clipPath={clipId && `url(#${clipId})`}
      data-drawing={clipId ? progress.toFixed(2) : undefined}
    >
      {clipId && (
        <clipPath id={clipId}>
          <rect x={-length} y={-length} width={length + progress * length} height={2 * length} />
        </clipPath>
      )}
      {/* Border stroke mirrors Cockatrice's `ArrowItem::paint`, which
       *  never calls `setPen` — so QPainter falls back to its default
       *  black 1-pixel pen and strokes the path's outline in addition to
       *  filling it. `stroke-width="1"` in the arrow's local coord system
       *  (where the shaft is 15 units wide) reads as the same relative
       *  thickness the desktop client draws. `stroke-linejoin="round"`
       *  keeps the shaft/head junction from ticking outward at sharp
       *  angles. Opaque black regardless of the fill's α — Qt::black is
       *  fully opaque. */}
      <path
        d={geom.d}
        fill={color}
        stroke="black"
        strokeWidth={1}
        strokeLinejoin="round"
        onClick={onClick}
        data-testid={testId}
        className={className}
      />
    </g>
  );
}

function GameArrowOverlay({ containerRef, layoutVersion, dragPreview = null }: GameArrowOverlayProps) {
  const gameId = useGameId();
  const { arrows, gameArrowKeys, width, height, handleArrowClick } = useGameArrowOverlay({ gameId, containerRef, layoutVersion });
  const arrowDrawAnimation = useAnimationPreference('arrowDrawAnimation');
  const arriving = useArrivingArrows(gameArrowKeys, arrows.map(arrowKey));
  const clipScope = useId().replace(/[^\w-]/g, '');

  // Committed arrows always render at Cockatrice's "locked target" alpha
  // (α=200) — they've already resolved to a real endpoint.
  const COMMITTED_ALPHA = 200;

  const previewAlpha = dragPreview?.fullColor ? 200 : 150;

  void gameId;

  return (
    <svg
      className="game-arrow-overlay"
      data-testid="game-arrow-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {arrows.map((a) => (
        <ArrowShape
          key={arrowKey(a)}
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          color={applyAlpha(a.color, COMMITTED_ALPHA)}
          onClick={() => handleArrowClick(a.arrowId)}
          testId={`arrow-${a.arrowId}`}
          className="game-arrow-overlay__shape"
          drawIn={{ id: `${clipScope}-${a.ownerPlayerId}-${a.arrowId}`, animate: arrowDrawAnimation && arriving.has(arrowKey(a)) }}
        />
      ))}
      {dragPreview && (
        <ArrowShape
          x1={dragPreview.x1}
          y1={dragPreview.y1}
          x2={dragPreview.x2}
          y2={dragPreview.y2}
          color={applyAlpha(dragPreview.color, previewAlpha)}
          testId="arrow-preview"
          className="game-arrow-overlay__shape game-arrow-overlay__shape--preview"
        />
      )}
    </svg>
  );
}

export default GameArrowOverlay;
