import { Images } from 'lucide-react';

import { CardSourcesSettings } from '@app/feature-widgets/card-import';

import { SettingsSectionId, type SettingsSection } from '../registry';

export const cardSourcesSection: SettingsSection = {
  id: SettingsSectionId.CardSources,
  titleKey: 'Settings.section.cardSources',
  icon: Images,
  groups: [
    {
      id: 'cardSources.downloads',
      titleKey: 'SettingsCardSources.group.downloads',
      entries: [
        {
          id: 'pictureUrlTemplates',
          labelKey: 'SettingsCardSources.pictureUrls.label',
          descriptionKey: 'SettingsCardSources.pictureUrls.description',
          control: { kind: 'custom', component: CardSourcesSettings, layout: 'block' },
        },
      ],
    },
  ],
};
