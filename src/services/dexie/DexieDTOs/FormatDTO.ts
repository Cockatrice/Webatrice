import { IndexableType } from 'dexie';
import { Format } from '../types/Format';
import { dexieService } from '../DexieService';

export class FormatDTO extends Format {
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
