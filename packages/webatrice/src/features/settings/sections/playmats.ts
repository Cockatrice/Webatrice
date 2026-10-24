import { Palette } from 'lucide-react';

import {
  PlaymatCollection,
  PlaymatListModeSelect,
  PlaymatModeSelect,
  PlaymatVisibilitySelect,
} from '../playmats/PlaymatControls';
import { SettingsSectionId, type SettingsSection } from '../registry';

export const playmatsSection: SettingsSection = {
  id: SettingsSectionId.Appearance,
  titleKey: 'Settings.section.appearance',
  icon: Palette,
  groups: [
    {
      id: 'appearance.playmats',
      titleKey: 'PlaymatSettings.title',
      entries: [
        {
          id: 'playmatVisibility',
          labelKey: 'PlaymatSettings.visibility.label',
          descriptionKey: 'PlaymatSettings.serverNote',
          control: { kind: 'custom', component: PlaymatVisibilitySelect, keys: ['playmatSettings'] },
        },
        {
          id: 'playmatMode',
          labelKey: 'PlaymatSettings.mode.label',
          descriptionKey: 'PlaymatSettings.mode.description',
          control: { kind: 'custom', component: PlaymatModeSelect, keys: ['playmatSettings'] },
        },
        {
          id: 'playmatCollection',
          labelKey: 'PlaymatSettings.collection.title',
          descriptionKey: 'PlaymatSettings.collection.description',
          control: { kind: 'custom', component: PlaymatCollection, keys: ['playmatSettings'], layout: 'block' },
        },
        {
          id: 'playmatListMode',
          labelKey: 'PlaymatSettings.collection.listMode',
          control: { kind: 'custom', component: PlaymatListModeSelect, keys: ['playmatSettings'] },
        },
      ],
    },
  ],
};
