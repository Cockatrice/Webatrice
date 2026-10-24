import { Palette } from 'lucide-react';

import ThemeNameTiles from '../controls/ThemeNameTiles';
import ThemeTiles from '../controls/ThemeTiles';
import { SettingsSectionId, type SettingsSection } from '../registry';

export const themeSection: SettingsSection = {
  id: SettingsSectionId.Appearance,
  titleKey: 'Settings.section.appearance',
  icon: Palette,
  groups: [
    {
      id: 'appearance.theme',
      titleKey: 'SettingsAppearance.group.theme',
      entries: [
        {
          id: 'themeName',
          labelKey: 'SettingsAppearance.themeName.label',
          descriptionKey: 'SettingsAppearance.themeName.description',
          control: { kind: 'custom', component: ThemeNameTiles, keys: ['themeName'], layout: 'block' },
        },
        {
          id: 'themeMode',
          labelKey: 'SettingsAppearance.themeMode.label',
          descriptionKey: 'SettingsAppearance.themeMode.description',
          control: { kind: 'custom', component: ThemeTiles, keys: ['themeMode'], layout: 'block' },
        },
      ],
    },
  ],
};
