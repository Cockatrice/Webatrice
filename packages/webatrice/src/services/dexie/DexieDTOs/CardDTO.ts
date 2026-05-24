import { IndexableType } from 'dexie';
import { Card } from '../types/Card';
import { dexieService } from '../DexieService';

export class CardDTO extends Card {
  save() {
    return dexieService.cards.put(this);
  }

  static get(name: string) {
    return dexieService.cards.where('name.value').equalsIgnoreCase(name).first();
  }

  static bulkAdd(cards: CardDTO[]): Promise<IndexableType> {
    return dexieService.cards.bulkPut(cards);
  }
}

dexieService.cards.mapToClass(CardDTO);
