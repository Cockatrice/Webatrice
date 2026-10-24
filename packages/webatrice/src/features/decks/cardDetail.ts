import type { RelatedCardKind } from '@app/components';
import type { DetailTarget, ScryfallDetail, ScryfallDetailFace } from '@app/services';

import type { DeckCard } from './types';

export interface BrowsedCard extends DetailTarget {
  kind: RelatedCardKind;
}

export function resolveDetailRow(
  deckCards: DeckCard[],
  snapshot: DeckCard,
  browsed: BrowsedCard | null,
): number {
  if (!browsed) {
    return deckCards.findIndex((c) => c.name === snapshot.name && c.category === snapshot.category);
  }
  const mainIdx = deckCards.findIndex((c) => c.name === browsed.name && c.category === 'main');
  if (mainIdx >= 0) {
    return mainIdx;
  }
  return deckCards.findIndex((c) => c.name === browsed.name);
}

export interface CardDetailView {
  name: string;
  imageUrl?: string;
  typeLine: string;
  oracle: string;
  flavor: string;
  manaCost: string;
  cmc?: number;
  setCode?: string;
  collectorNumber?: string;
}

export function describeCardDetail({
  detail,
  face,
  activeName,
  liveCard,
  fallback,
}: {
  detail: ScryfallDetail | null;
  face: ScryfallDetailFace | undefined;
  activeName: string;
  liveCard: DeckCard | null;
  fallback: Partial<DeckCard>;
}): CardDetailView {
  const cmc = (() => {
    if (face) {
      if (!(face.mana_cost ?? '')) {
        return undefined;
      }
      if (typeof face.cmc === 'number') {
        return face.cmc;
      }
    }
    return typeof detail?.cmc === 'number' ? detail.cmc : liveCard?.cmc ?? fallback.cmc;
  })();
  return {
    name: face?.name ?? activeName,
    imageUrl:
      face?.image_uris?.normal
      ?? face?.image_uris?.large
      ?? detail?.image_uris?.normal
      ?? detail?.image_uris?.large,
    typeLine: face?.type_line ?? detail?.type_line ?? liveCard?.typeLine ?? fallback.typeLine ?? '',
    oracle: face?.oracle_text ?? detail?.oracle_text ?? '',
    flavor: face?.flavor_text ?? detail?.flavor_text ?? '',
    manaCost: face?.mana_cost ?? detail?.mana_cost ?? liveCard?.manaCost ?? fallback.manaCost ?? '',
    cmc,
    setCode: detail?.set ?? liveCard?.set ?? fallback.set,
    collectorNumber: detail?.collector_number ?? liveCard?.collectorNumber ?? fallback.collectorNumber,
  };
}

export function canAddBrowsedCard(kind: RelatedCardKind): boolean {
  return kind === 'meld_part' || kind === 'combo_piece';
}
