import { IndexableType } from 'dexie';
import { Token } from '../types/Token';
import { dexieService } from '../DexieService';

export class TokenDTO extends Token {
  save() {
    return dexieService.tokens.put(this);
  }

  static get(name: string) {
    return dexieService.tokens.where('name.value').equalsIgnoreCase(name).first();
  }

  static bulkAdd(tokens: TokenDTO[]): Promise<IndexableType> {
    return dexieService.tokens.bulkPut(tokens);
  }
}

dexieService.tokens.mapToClass(TokenDTO);
