// Faithful port of Cockatrice desktop's `ArrowItem::updatePath` (see
// game_graphics/board/arrow_item.cpp:73-125). The desktop client builds the
// arrow as a filled QPainterPath: a curved shaft (quadratic Bezier) that
// widens into a triangular head. The shape lives in a LOCAL coordinate
// frame where the source is at (0, 0) and the target sits at (lineLength,
// 0); it's placed into the scene via `setPos(startPoint)` +
// `setTransform(rotate(-line.angle()))`.
//
// The math is preserved 1:1 so the browser-side rendering matches the
// desktop's arrow exactly:
//   • Both Qt (QGraphicsScene) and SVG use Y-DOWN screen coordinates, so
//     the local `y` values port straight through.
//   • Qt's `QLineF::angle()` uses a Y-UP convention (`atan2(-dy, dx)`) —
//     the internal `alpha = testLine.angle() - 90` is in that same Y-UP
//     convention. Cockatrice compensates with the `(cos α, -sin α)` offset
//     pattern to reinterpret it back into Y-DOWN local coordinates. We
//     preserve that pattern exactly.
//   • Qt's `rotate(-line.angle())` and SVG's `rotate(θ)` share the same
//     visual sign convention (positive = clockwise on-screen), so the
//     final SVG rotation angle is `Math.atan2(dy, dx) * 180 / Math.PI`.

const ARROW_WIDTH = 15;
const HEAD_WIDTH = 40;
const HEAD_LENGTH = HEAD_WIDTH / Math.sqrt(2);
const PHI_DEG = 15;
const TAN_PHI = Math.tan((PHI_DEG * Math.PI) / 180);

/** Below this pixel distance Cockatrice renders no arrow at all — the
 *  head geometry stops making sense when the shaft is shorter than the
 *  head. Kept identical to the desktop threshold. */
export const ARROW_MIN_LINE_LENGTH = 30;

/** Local Y offset from the base line to the curve's control point. Also
 *  useful to callers that want to expand the SVG viewBox / hit-testing to
 *  include the curve's bulge. */
export function arrowControlPointYOffset(lineLength: number): number {
  return TAN_PHI * lineLength;
}

interface Point {
  x: number;
  y: number;
}

// Quadratic Bezier evaluation: p0 (1-t)² + p1 · 2(1-t)t + p2 · t².
function quadPoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export interface ArrowGeometry {
  /** SVG `d` attribute — a closed filled path in LOCAL coords (start at
   *  origin, tip at (lineLength, 0)). */
  d: string;
  /** Where the arrow anchors in viewport coordinates (start-side). */
  originX: number;
  originY: number;
  /** SVG rotation in degrees to align local +X with the line direction.
   *  Apply as `translate(originX, originY) rotate(angleDeg)`. */
  angleDeg: number;
}

/** Build the SVG path for a Cockatrice-style arrow between two viewport
 *  points. Returns null when the segment is shorter than the desktop's
 *  min-length threshold (matches Cockatrice, which draws nothing in that
 *  case). */
export function buildArrowGeometry(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): ArrowGeometry | null {
  const dx = ex - sx;
  const dy = ey - sy;
  const lineLength = Math.hypot(dx, dy);
  if (lineLength < ARROW_MIN_LINE_LENGTH) {
    return null;
  }

  // Local control point that bows the shaft away from the base line.
  // Positive Y in local coords = down in the LOCAL frame (which then
  // rotates with the arrow), matching Cockatrice's local Qt coords.
  const c: Point = { x: lineLength / 2, y: TAN_PHI * lineLength };
  const p0: Point = { x: 0, y: 0 };
  const p2: Point = { x: lineLength, y: 0 };

  // Sample the curve just before the tip to find the shaft's exit
  // direction — the head triangle rotates to sit flush against it. The
  // percentage matches Cockatrice's `1 - headLength / lineLength`.
  const percentage = 1 - HEAD_LENGTH / lineLength;
  const arrowBodyEnd = quadPoint(percentage, p0, c, p2);
  const testEnd = quadPoint(percentage + 0.001, p0, c, p2);

  // Cockatrice's `QLineF::angle()` is `atan2(-dy, dx)` in degrees (Y-up
  // math convention). We port the formula verbatim so the `(cos, -sin)`
  // offsets below reinterpret consistently.
  const testDx = testEnd.x - arrowBodyEnd.x;
  const testDy = testEnd.y - arrowBodyEnd.y;
  const testLineAngleDeg = (Math.atan2(-testDy, testDx) * 180) / Math.PI;
  const alphaDeg = testLineAngleDeg - 90;
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const cosA = Math.cos(alphaRad);
  const sinA = Math.sin(alphaRad);

  // Perpendicular half-shaft offsets at the shaft/head junction.
  const endPoint1: Point = {
    x: arrowBodyEnd.x + (ARROW_WIDTH / 2) * cosA,
    y: arrowBodyEnd.y - (ARROW_WIDTH / 2) * sinA,
  };
  const endPoint2: Point = {
    x: arrowBodyEnd.x - (ARROW_WIDTH / 2) * cosA,
    y: arrowBodyEnd.y + (ARROW_WIDTH / 2) * sinA,
  };

  // Outer head-triangle corners: extend `endPoint{1,2}` outward by half
  // the head width minus half the shaft width so the head widens beyond
  // the shaft.
  const point1: Point = {
    x: endPoint1.x + ((HEAD_WIDTH - ARROW_WIDTH) / 2) * cosA,
    y: endPoint1.y - ((HEAD_WIDTH - ARROW_WIDTH) / 2) * sinA,
  };
  const point2: Point = {
    x: endPoint2.x - ((HEAD_WIDTH - ARROW_WIDTH) / 2) * cosA,
    y: endPoint2.y + ((HEAD_WIDTH - ARROW_WIDTH) / 2) * sinA,
  };

  // Shaft start: two offset points perpendicular to the tangent AT the
  // start of the curve. Cockatrice uses the constant `phi - 90` here as
  // a lightweight approximation of that tangent perpendicular; keep the
  // exact same offset so the shaft root looks identical.
  const phiMinus90Rad = ((PHI_DEG - 90) * Math.PI) / 180;
  const cosPhi = Math.cos(phiMinus90Rad);
  const sinPhi = Math.sin(phiMinus90Rad);
  const startTop: Point = {
    x: -(ARROW_WIDTH / 2) * cosPhi,
    y: -(ARROW_WIDTH / 2) * sinPhi,
  };
  const startBot: Point = {
    x: (ARROW_WIDTH / 2) * cosPhi,
    y: (ARROW_WIDTH / 2) * sinPhi,
  };

  const fmt = (n: number) => n.toFixed(3);
  const d = [
    `M ${fmt(startTop.x)} ${fmt(startTop.y)}`,
    `Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(endPoint1.x)} ${fmt(endPoint1.y)}`,
    `L ${fmt(point1.x)} ${fmt(point1.y)}`,
    `L ${fmt(lineLength)} 0`,
    `L ${fmt(point2.x)} ${fmt(point2.y)}`,
    `L ${fmt(endPoint2.x)} ${fmt(endPoint2.y)}`,
    `Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(startBot.x)} ${fmt(startBot.y)}`,
    'Z',
  ].join(' ');

  return {
    d,
    originX: sx,
    originY: sy,
    // `atan2(dy, dx)` gives the SVG-native rotation angle. See the header
    // comment for why this matches Cockatrice's `rotate(-line.angle())`.
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
