import { Palette } from 'lucide-react';

import ZoneBackgroundsEditor from '../controls/ZoneBackgroundsEditor';
import { SettingsSectionId, type SettingsSection } from '../registry';

export const appearanceSection: SettingsSection = {
  id: SettingsSectionId.Appearance,
  titleKey: 'Settings.section.appearance',
  icon: Palette,
  groups: [
    {
      id: 'appearance.zoneBackgrounds',
      titleKey: 'SettingsAppearance.group.zoneBackgrounds',
      entries: [
        {
          id: 'zoneBackgrounds',
          labelKey: 'SettingsAppearance.zoneBackgrounds.label',
          descriptionKey: 'SettingsAppearance.zoneBackgrounds.description',
          control: { kind: 'custom', component: ZoneBackgroundsEditor, keys: ['zoneBackgrounds'], layout: 'block' },
        },
      ],
    },
    {
      id: 'appearance.menus',
      titleKey: 'SettingsAppearance.group.menus',
      entries: [
        {
          id: 'showShortcutsInMenus',
          labelKey: 'SettingsAppearance.showShortcutsInMenus.label',
          control: { kind: 'toggle', key: 'showShortcutsInMenus' },
        },
      ],
    },
    {
      id: 'appearance.cardPrintings',
      titleKey: 'SettingsAppearance.group.cardPrintings',
      entries: [
        {
          id: 'bumpSetsWithCardsInDeckToTop',
          labelKey: 'SettingsAppearance.bumpSetsWithCardsInDeckToTop.label',
          control: { kind: 'toggle', key: 'bumpSetsWithCardsInDeckToTop' },
        },
      ],
    },
    {
      id: 'appearance.cardRendering',
      titleKey: 'SettingsAppearance.group.cardRendering',
      entries: [
        {
          id: 'displayCardNames',
          labelKey: 'SettingsAppearance.displayCardNames.label',
          descriptionKey: 'SettingsAppearance.displayCardNames.description',
          control: { kind: 'toggle', key: 'displayCardNames' },
        },
        {
          id: 'autoRotateSidewaysLayoutCards',
          labelKey: 'SettingsAppearance.autoRotateSidewaysLayoutCards.label',
          descriptionKey: 'SettingsAppearance.autoRotateSidewaysLayoutCards.description',
          control: { kind: 'toggle', key: 'autoRotateSidewaysLayoutCards' },
        },
        {
          id: 'scaleCards',
          labelKey: 'SettingsAppearance.scaleCards.label',
          control: { kind: 'toggle', key: 'scaleCards' },
        },
        {
          id: 'roundCardCorners',
          labelKey: 'SettingsAppearance.roundCardCorners.label',
          control: { kind: 'toggle', key: 'roundCardCorners' },
        },
        {
          id: 'maxFontSizeForCards',
          labelKey: 'SettingsAppearance.maxFontSizeForCards.label',
          control: { kind: 'number', key: 'maxFontSizeForCards', min: 9, max: 100 },
        },
      ],
    },
    {
      id: 'appearance.cardLayout',
      titleKey: 'SettingsAppearance.group.cardLayout',
      entries: [
        {
          id: 'verticalCardOverlapPercent',
          labelKey: 'SettingsAppearance.verticalCardOverlapPercent.label',
          control: { kind: 'number', key: 'verticalCardOverlapPercent', min: 0, max: 80, unitKey: 'SettingsAppearance.percentSuffix' },
        },
        {
          id: 'cardViewInitialRowsMax',
          labelKey: 'SettingsAppearance.cardViewInitialRowsMax.label',
          control: {
            kind: 'number',
            key: 'cardViewInitialRowsMax',
            min: 1,
            max: 999,
            unitKey: 'SettingsAppearance.rowsSuffix',
            pushes: { key: 'cardViewExpandedRowsMax', keep: 'atLeast' },
          },
        },
        {
          id: 'cardViewExpandedRowsMax',
          labelKey: 'SettingsAppearance.cardViewExpandedRowsMax.label',
          descriptionKey: 'SettingsAppearance.cardViewExpandedRowsMax.description',
          control: {
            kind: 'number',
            key: 'cardViewExpandedRowsMax',
            min: 1,
            max: 999,
            unitKey: 'SettingsAppearance.rowsSuffix',
            pushes: { key: 'cardViewInitialRowsMax', keep: 'atMost' },
          },
        },
      ],
    },
    {
      id: 'appearance.cardCounters',
      titleKey: 'SettingsAppearance.group.cardCounters',
      entries: [
        {
          id: 'cardCounterColorA',
          labelKey: 'SettingsAppearance.cardCounterColor.A',
          control: { kind: 'color', key: 'cardCounterColorA' },
        },
        {
          id: 'cardCounterColorB',
          labelKey: 'SettingsAppearance.cardCounterColor.B',
          control: { kind: 'color', key: 'cardCounterColorB' },
        },
        {
          id: 'cardCounterColorC',
          labelKey: 'SettingsAppearance.cardCounterColor.C',
          control: { kind: 'color', key: 'cardCounterColorC' },
        },
        {
          id: 'cardCounterColorD',
          labelKey: 'SettingsAppearance.cardCounterColor.D',
          control: { kind: 'color', key: 'cardCounterColorD' },
        },
        {
          id: 'cardCounterColorE',
          labelKey: 'SettingsAppearance.cardCounterColor.E',
          control: { kind: 'color', key: 'cardCounterColorE' },
        },
        {
          id: 'cardCounterColorF',
          labelKey: 'SettingsAppearance.cardCounterColor.F',
          control: { kind: 'color', key: 'cardCounterColorF' },
        },
      ],
    },
    {
      id: 'appearance.handLayout',
      titleKey: 'SettingsAppearance.group.handLayout',
      entries: [
        {
          id: 'horizontalHand',
          labelKey: 'SettingsAppearance.horizontalHand.label',
          descriptionKey: 'SettingsAppearance.horizontalHand.description',
          control: { kind: 'toggle', key: 'horizontalHand' },
        },
        {
          id: 'leftJustifiedHand',
          labelKey: 'SettingsAppearance.leftJustifiedHand.label',
          descriptionKey: 'SettingsAppearance.leftJustifiedHand.description',
          control: { kind: 'toggle', key: 'leftJustifiedHand' },
        },
      ],
    },
    {
      id: 'appearance.tableGrid',
      titleKey: 'SettingsAppearance.group.tableGrid',
      entries: [
        {
          id: 'invertVerticalCoordinate',
          labelKey: 'SettingsAppearance.invertVerticalCoordinate.label',
          descriptionKey: 'SettingsAppearance.invertVerticalCoordinate.description',
          control: { kind: 'toggle', key: 'invertVerticalCoordinate' },
        },
        {
          id: 'minPlayersForMultiColumnLayout',
          labelKey: 'SettingsAppearance.minPlayersForMultiColumnLayout.label',
          control: { kind: 'number', key: 'minPlayersForMultiColumnLayout', min: 2, max: 99 },
        },
      ],
    },
    {
      id: 'appearance.signIn',
      titleKey: 'SettingsAppearance.group.signIn',
      entries: [
        {
          id: 'signInCardArt',
          labelKey: 'SettingsAppearance.signInCardArt.label',
          descriptionKey: 'SettingsAppearance.signInCardArt.description',
          control: { kind: 'toggle', key: 'signInCardArt' },
        },
      ],
    },
  ],
};
