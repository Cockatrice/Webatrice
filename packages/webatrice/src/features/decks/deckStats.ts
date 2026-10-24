import { MANA_COLORS, type ManaColor } from './manaSymbols';
import { primaryType, type CardTypeGroup, type DeckCard } from './types';

export const CURVE_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export interface DeckStats {
  totalCards: number;
  nonlandCards: number;
  landCount: number;
  avgNonlandCmc: number;
  curve: Record<number, number>;
  pips: Record<ManaColor, number>;
  typeCounts: Partial<Record<CardTypeGroup, number>>;
}

export function computeDeckStats(cards: DeckCard[]): DeckStats {
  let totalCards = 0;
  let nonlandCards = 0;
  let landCount = 0;
  let totalNonlandCmc = 0;
  const curve: Record<number, number> = {};
  // Card-based color distribution (NOT pip counting): each nonland
  // card contributes its quantity to every color of its identity, or
  // to `C` if it's colorless. That way Sol Ring and Eldrazi actually
  // show up in the pie, and multicolor cards register in each color.
  const pips: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const typeCounts: Partial<Record<CardTypeGroup, number>> = {};

  for (const card of cards) {
    const qty = card.quantity;
    totalCards += qty;
    const type = primaryType(card.typeLine);
    typeCounts[type] = (typeCounts[type] ?? 0) + qty;

    if (type === 'Land') {
      landCount += qty;
    } else {
      nonlandCards += qty;
      const cmc = card.cmc ?? 0;
      const bucket = cmc >= 7 ? 7 : Math.floor(cmc);
      curve[bucket] = (curve[bucket] ?? 0) + qty;
      totalNonlandCmc += cmc * qty;

      const cardColors = card.colors ?? [];
      if (cardColors.length === 0) {
        pips.C += qty;
      } else {
        for (const raw of cardColors) {
          if (raw === 'W' || raw === 'U' || raw === 'B' || raw === 'R' || raw === 'G') {
            pips[raw] += qty;
          }
        }
      }
    }
  }

  return {
    totalCards,
    nonlandCards,
    landCount,
    avgNonlandCmc: nonlandCards > 0 ? totalNonlandCmc / nonlandCards : 0,
    curve,
    pips,
    typeCounts,
  };
}

export function sortedTypeCounts(
  counts: Partial<Record<CardTypeGroup, number>>,
): Array<[CardTypeGroup, number]> {
  return (Object.entries(counts) as [CardTypeGroup, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function colorPieSlices(
  pips: Record<ManaColor, number>,
  radius: number,
): Array<{ color: ManaColor; path: string }> {
  const total = MANA_COLORS.reduce((s, c) => s + pips[c], 0);
  if (total === 0) {
    return [];
  }

  let acc = 0;
  return MANA_COLORS.filter((c) => pips[c] > 0).map((c) => {
    const sweep = (pips[c] / total) * 360;
    const start = acc;
    const end = acc + sweep;
    acc = end;

    // Full-circle degenerate case: `A` can't draw a 360° arc directly,
    // so fall back to two 180° arcs using a full circle path.
    let path: string;
    if (sweep >= 359.999) {
      const top = polar(radius, radius, radius, 0);
      const bottom = polar(radius, radius, radius, 180);
      path = [
        `M ${top.x} ${top.y}`,
        `A ${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y}`,
        `A ${radius} ${radius} 0 1 1 ${top.x} ${top.y}`,
        'Z',
      ].join(' ');
    } else {
      const p1 = polar(radius, radius, radius, start);
      const p2 = polar(radius, radius, radius, end);
      const largeArc = sweep > 180 ? 1 : 0;
      path = [
        `M ${radius} ${radius}`,
        `L ${p1.x} ${p1.y}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
        'Z',
      ].join(' ');
    }

    return { color: c, path };
  });
}
