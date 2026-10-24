import { DEFAULT_PICTURE_URL_TEMPLATES } from '../../cardDatabase/pictureUrlTemplates';
import { CardDataSettings } from '../types/CardDataSettings';
import { dexieService } from '../DexieService';

export class CardDataSettingsDTO extends CardDataSettings {
  constructor(settings?: Partial<CardDataSettings>) {
    super();
    this.id = 'singleton';
    this.cardOverrides = { ...settings?.cardOverrides };
    this.pictureUrlTemplates = settings?.pictureUrlTemplates ?? [...DEFAULT_PICTURE_URL_TEMPLATES];
    this.alwaysEnableNewSets = settings?.alwaysEnableNewSets ?? false;
    this.lastUpdateCheck = settings?.lastUpdateCheck;
  }

  save() {
    return dexieService.cardDataSettings.put(this);
  }

  static async get(): Promise<CardDataSettingsDTO> {
    const stored: CardDataSettings | undefined = await dexieService.cardDataSettings.get('singleton');
    return new CardDataSettingsDTO(stored ?? undefined);
  }

  static async setCardOverride(name: string, providerId: string | undefined): Promise<void> {
    await dexieService.readWrite([dexieService.cardDataSettings], async () => {
      const settings = await CardDataSettingsDTO.get();
      if (providerId) {
        settings.cardOverrides[name] = providerId;
      } else {
        delete settings.cardOverrides[name];
      }
      await settings.save();
    });
  }
}
