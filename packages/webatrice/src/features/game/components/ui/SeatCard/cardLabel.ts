import type { TFunction } from 'i18next';

import { COUNTER_TYPE_LABELS } from './counterColors';

export interface CardLabelState {
  name: string;
  id?: string;
  faceDown?: boolean;
  tapped?: boolean;
  doesntUntap?: boolean;
  attached?: boolean;
  pt?: string;
  counters?: readonly { id: number; value: number }[];
  annotation?: string;
}

export function counterLetter(id: number): string {
  return COUNTER_TYPE_LABELS[id] ?? String(id);
}

export function cardLabel(t: TFunction, card: CardLabelState): string {
  const parts = [card.faceDown && card.id != null ? t('SeatCard.faceDown', { id: `#${card.id}` }) : card.name];
  if (card.tapped) {
    parts.push(t('SeatCard.tapped'));
  }
  if (card.doesntUntap) {
    parts.push(t('SeatCard.doesntUntap'));
  }
  if (card.attached) {
    parts.push(t('SeatCard.attached'));
  }
  if (card.pt) {
    parts.push(t('SeatCard.pt', { pt: card.pt }));
  }
  for (const counter of card.counters ?? []) {
    parts.push(t('SeatCard.counter', { count: counter.value, letter: counterLetter(counter.id) }));
  }
  if (card.annotation) {
    parts.push(t('SeatCard.annotation', { text: card.annotation }));
  }
  return parts.join(', ');
}
