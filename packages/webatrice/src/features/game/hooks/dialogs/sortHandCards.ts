import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import type { Card } from '../../../../services/dexie/types/Card';
import type { HandSortKey } from './gameDialogs.types';

export interface HandSortCard {
  card: Pick<ServerInfo_Card, 'id' | 'name' | 'providerId'>;
  metadata?: Pick<Card, 'prop'>;
}

function colorSortString(properties: Record<string, { value: string }>): string {
  const colors = properties.colors?.value ?? '';
  if (colors.length === 0) {
    return properties.type?.value.includes('Land') ? 'a_land' : 'b_colorless';
  }
  if (colors.length === 1) {
    const prefix = ({ W: 'c', U: 'd', B: 'e', R: 'f', G: 'g' } as Record<string, string>)[colors] ?? 'h';
    return `${prefix}_${colors}`;
  }
  return `i${colors.length}_${colors}`;
}

function sortKeys({ card, metadata }: HandSortCard, key: HandSortKey): string[] {
  const properties = metadata?.prop?.value ?? {};
  const nameAndPrinting = [card.name, card.providerId];
  const manaValue = metadata ? (properties.cmc?.value ?? '').padStart(4, '0') : '';
  if (key === 'maintype') {
    return [properties.maintype?.value ?? '', manaValue, ...nameAndPrinting];
  }
  if (key === 'manacost') {
    return [manaValue, metadata ? colorSortString(properties) : '', ...nameAndPrinting];
  }
  return nameAndPrinting;
}

export function sortHandCards(cards: readonly HandSortCard[], key: HandSortKey): number[] {
  return cards.map((entry) => ({ id: entry.card.id, keys: sortKeys(entry, key) }))
    .sort((a, b) => {
      for (let i = 0; i < a.keys.length; i++) {
        if (a.keys[i] !== b.keys[i]) {
          return a.keys[i] < b.keys[i] ? -1 : 1;
        }
      }
      return 0;
    })
    .map(({ id }) => id);
}
