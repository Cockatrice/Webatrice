import { SetPreference } from '../types/SetPreference';
import { dexieService } from '../DexieService';

export class SetPreferenceDTO extends SetPreference {
  static getAll(): Promise<SetPreferenceDTO[]> {
    return dexieService.setPreferences.toArray();
  }

  static bulkPut(preferences: SetPreference[]) {
    return dexieService.setPreferences.bulkPut(preferences);
  }
}

dexieService.setPreferences.mapToClass(SetPreferenceDTO);
