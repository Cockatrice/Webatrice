import { HardDrive } from 'lucide-react';

import {
  ClearCardDataControl,
  ClearScryfallCacheControl,
  PersistentStorageControl,
  StorageUsageControl,
} from '../controls/StorageControls';
import { SettingsSectionId, type SettingsSection } from '../registry';

export const storageSection: SettingsSection = {
  id: SettingsSectionId.Storage,
  titleKey: 'Settings.section.storage',
  icon: HardDrive,
  groups: [
    {
      id: 'storage.usage',
      titleKey: 'SettingsStorage.group.usage',
      entries: [
        {
          id: 'storageUsage',
          labelKey: 'SettingsStorage.usage.label',
          descriptionKey: 'SettingsStorage.usage.description',
          control: { kind: 'custom', component: StorageUsageControl, layout: 'block' },
        },
        {
          id: 'persistentStorage',
          labelKey: 'SettingsStorage.persistent.label',
          descriptionKey: 'SettingsStorage.persistent.description',
          control: { kind: 'custom', component: PersistentStorageControl },
        },
      ],
    },
    {
      id: 'storage.clear',
      titleKey: 'SettingsStorage.group.clear',
      entries: [
        {
          id: 'clearScryfallCache',
          labelKey: 'SettingsStorage.scryfallCache.label',
          descriptionKey: 'SettingsStorage.scryfallCache.description',
          control: { kind: 'custom', component: ClearScryfallCacheControl },
        },
        {
          id: 'clearCardData',
          labelKey: 'SettingsStorage.cardData.label',
          descriptionKey: 'SettingsStorage.cardData.description',
          control: { kind: 'custom', component: ClearCardDataControl },
        },
      ],
    },
  ],
};
