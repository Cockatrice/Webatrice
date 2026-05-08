import { IndexableType } from 'dexie';
import { App } from '@app/types';

import { dexieService } from '../DexieService';

export class FormatDTO extends App.Format {
  save() {
    return dexieService.formats.put(this);
  }

  static get(formatName: string) {
    return dexieService.formats.where('formatName').equalsIgnoreCase(formatName).first();
  }

  static getAll(): Promise<FormatDTO[]> {
    return dexieService.formats.toArray();
  }

  static bulkAdd(formats: FormatDTO[]): Promise<IndexableType> {
    return dexieService.formats.bulkPut(formats);
  }
}

dexieService.formats.mapToClass(FormatDTO);
