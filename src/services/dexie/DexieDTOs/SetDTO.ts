import { IndexableType } from 'dexie';
import { Set } from '@app/types';
import { dexieService } from '../DexieService';

export class SetDTO extends Set {
  save() {
    return dexieService.sets.put(this);
  }

  static get(name: string) {
    return dexieService.sets.where('name.value').equalsIgnoreCase(name).first();
  }

  static bulkAdd(sets: SetDTO[]): Promise<IndexableType> {
    return dexieService.sets.bulkPut(sets);
  }
}

dexieService.sets.mapToClass(SetDTO);
