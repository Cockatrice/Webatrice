import { PREFERENCE_DEFAULTS, SETTINGS_VERSION, Setting } from '@app/types';
import { dexieService } from '../DexieService';

export class SettingDTO extends Setting {
  constructor(user: string) {
    super();

    this.user = user;
    this.version = SETTINGS_VERSION;
    Object.assign(this, structuredClone(PREFERENCE_DEFAULTS));
  }

  save() {
    return dexieService.settings.put(this);
  }

  static get(user: string) {
    return dexieService.settings.where('user').equalsIgnoreCase(user).first();
  }
}

dexieService.settings.mapToClass(SettingDTO);
