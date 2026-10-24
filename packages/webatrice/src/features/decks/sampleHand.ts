import type { DeckCard } from './types';

export const DEFAULT_SAMPLE_HAND_SIZE = 7;
export const MIN_SAMPLE_HAND_SIZE = 1;

export function sampleLibrary(cards: readonly DeckCard[]): DeckCard[] {
  const library: DeckCard[] = [];
  for (const card of cards) {
    if (card.category !== 'main' || card.isCommander) {
      continue;
    }
    for (let i = 0; i < card.quantity; i++) {
      library.push(card);
    }
  }
  return library;
}

export function drawSampleHand(
  library: readonly DeckCard[],
  size: number,
  random: () => number = Math.random,
): DeckCard[] {
  const shuffled = library.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled
    .slice(0, Math.max(0, Math.min(size, shuffled.length)))
    .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0));
}

export function clampHandSize(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_SAMPLE_HAND_SIZE, Math.floor(value)) : DEFAULT_SAMPLE_HAND_SIZE;
}
