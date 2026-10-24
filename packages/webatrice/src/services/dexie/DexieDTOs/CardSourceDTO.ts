import { CardSource, type CardSourcePayload } from '../types/CardSource';
import { dexieService } from '../DexieService';

export class CardSourceDTO extends CardSource {
  save() {
    return dexieService.cardSources.put(this);
  }

  static get(id: string): Promise<CardSourceDTO | undefined> {
    return dexieService.cardSources.get(id);
  }

  static getAll(): Promise<CardSourceDTO[]> {
    return dexieService.cardSources.toArray();
  }

  static put(source: CardSource) {
    return dexieService.cardSources.put(source);
  }

  static delete(id: string): Promise<void> {
    return dexieService.cardSources.delete(id);
  }

  static getPayload(id: string): Promise<CardSourcePayload | undefined> {
    return dexieService.cardSourcePayloads.get(id);
  }
}

dexieService.cardSources.mapToClass(CardSourceDTO);
