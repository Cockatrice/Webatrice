import { MousePointerClick } from 'lucide-react';

import { ANIMATION_PREFERENCE_KEYS } from '@app/hooks';
import { CommanderSpellbookIntegration, PlayBadgeMode, type PreferenceKey } from '@app/types';

import { AnimationButtons, animationToggle } from '../controls/AnimationControls';
import NotificationPermissionControl from '../controls/NotificationPermissionControl';
import { SettingsSectionId, type SettingsSection } from '../registry';

const ANIMATION_CHOICE_KEYS: readonly PreferenceKey[] = [...ANIMATION_PREFERENCE_KEYS, 'animationsChosen'];

export const userInterfaceSection: SettingsSection = {
  id: SettingsSectionId.UserInterface,
  titleKey: 'Settings.section.userInterface',
  icon: MousePointerClick,
  groups: [
    {
      id: 'userInterface.general',
      titleKey: 'SettingsUserInterface.group.general',
      entries: [
        {
          id: 'doubleClickToPlay',
          labelKey: 'SettingsUserInterface.doubleClickToPlay.label',
          control: { kind: 'toggle', key: 'doubleClickToPlay' },
        },
        {
          id: 'clickPlaysAllSelected',
          labelKey: 'SettingsUserInterface.clickPlaysAllSelected.label',
          descriptionKey: 'SettingsUserInterface.clickPlaysAllSelected.description',
          control: { kind: 'toggle', key: 'clickPlaysAllSelected' },
        },
        {
          id: 'playToStack',
          labelKey: 'SettingsUserInterface.playToStack.label',
          descriptionKey: 'SettingsUserInterface.playToStack.description',
          control: { kind: 'toggle', key: 'playToStack' },
        },
        {
          id: 'doNotDeleteArrowsInSubPhases',
          labelKey: 'SettingsUserInterface.doNotDeleteArrowsInSubPhases.label',
          descriptionKey: 'SettingsUserInterface.doNotDeleteArrowsInSubPhases.description',
          control: { kind: 'toggle', key: 'doNotDeleteArrowsInSubPhases' },
        },
        {
          id: 'closeEmptyCardView',
          labelKey: 'SettingsUserInterface.closeEmptyCardView.label',
          control: { kind: 'toggle', key: 'closeEmptyCardView' },
        },
        {
          id: 'focusCardViewSearchBar',
          labelKey: 'SettingsUserInterface.focusCardViewSearchBar.label',
          control: { kind: 'toggle', key: 'focusCardViewSearchBar' },
        },
        {
          id: 'annotateTokens',
          labelKey: 'SettingsUserInterface.annotateTokens.label',
          descriptionKey: 'SettingsUserInterface.annotateTokens.description',
          control: { kind: 'toggle', key: 'annotateTokens' },
        },
        {
          id: 'showDragSelectionCount',
          labelKey: 'SettingsUserInterface.showDragSelectionCount.label',
          control: { kind: 'toggle', key: 'showDragSelectionCount' },
        },
        {
          id: 'showTotalSelectionCount',
          labelKey: 'SettingsUserInterface.showTotalSelectionCount.label',
          control: { kind: 'toggle', key: 'showTotalSelectionCount' },
        },
        {
          id: 'keepGameChatFocus',
          labelKey: 'SettingsUserInterface.keepGameChatFocus.label',
          descriptionKey: 'SettingsUserInterface.keepGameChatFocus.description',
          control: { kind: 'toggle', key: 'keepGameChatFocus' },
        },
      ],
    },
    {
      id: 'userInterface.notifications',
      titleKey: 'SettingsUserInterface.group.notifications',
      entries: [
        {
          id: 'notificationsEnabled',
          labelKey: 'SettingsUserInterface.notificationsEnabled.label',
          descriptionKey: 'SettingsUserInterface.notificationsEnabled.description',
          control: { kind: 'toggle', key: 'notificationsEnabled' },
        },
        {
          id: 'spectatorNotificationsEnabled',
          labelKey: 'SettingsUserInterface.spectatorNotificationsEnabled.label',
          control: { kind: 'toggle', key: 'spectatorNotificationsEnabled' },
          dependsOn: 'notificationsEnabled',
        },
        {
          id: 'buddyConnectNotificationsEnabled',
          labelKey: 'SettingsUserInterface.buddyConnectNotificationsEnabled.label',
          control: { kind: 'toggle', key: 'buddyConnectNotificationsEnabled' },
          dependsOn: 'notificationsEnabled',
        },
        {
          id: 'playBadge',
          labelKey: 'SettingsUserInterface.playBadge.label',
          descriptionKey: 'SettingsUserInterface.playBadge.description',
          control: {
            kind: 'select',
            key: 'playBadge',
            options: [
              { value: PlayBadgeMode.Mentions, labelKey: 'SettingsUserInterface.playBadge.mentions' },
              { value: PlayBadgeMode.All, labelKey: 'SettingsUserInterface.playBadge.all' },
            ],
          },
        },
        {
          id: 'browserNotifications',
          labelKey: 'SettingsUserInterface.browserNotifications.label',
          descriptionKey: 'SettingsUserInterface.browserNotifications.description',
          control: { kind: 'custom', component: NotificationPermissionControl },
        },
      ],
    },
    {
      id: 'userInterface.animation',
      titleKey: 'SettingsUserInterface.group.animation',
      entries: [
        {
          id: 'allAnimations',
          labelKey: 'SettingsUserInterface.animations.all.label',
          descriptionKey: 'SettingsUserInterface.animations.all.description',
          control: { kind: 'custom', component: AnimationButtons, keys: ANIMATION_CHOICE_KEYS },
        },
        {
          id: 'tapAnimation',
          labelKey: 'SettingsUserInterface.tapAnimation.label',
          control: { kind: 'custom', component: animationToggle('tapAnimation'), keys: ['tapAnimation', 'animationsChosen'] },
        },
        {
          id: 'arrowDrawAnimation',
          labelKey: 'SettingsUserInterface.arrowDrawAnimation.label',
          control: {
            kind: 'custom',
            component: animationToggle('arrowDrawAnimation'),
            keys: ['arrowDrawAnimation', 'animationsChosen'],
          },
        },
        {
          id: 'lifeCounterAnimations',
          labelKey: 'SettingsUserInterface.lifeCounterAnimations.label',
          control: {
            kind: 'custom',
            component: animationToggle('lifeCounterAnimations'),
            keys: ['lifeCounterAnimations', 'animationsChosen'],
          },
        },
        {
          id: 'battlefieldFlash',
          labelKey: 'SettingsUserInterface.battlefieldFlash.label',
          control: {
            kind: 'custom',
            component: animationToggle('battlefieldFlash'),
            keys: ['battlefieldFlash', 'animationsChosen'],
          },
        },
      ],
    },
    {
      id: 'userInterface.deckEditor',
      titleKey: 'SettingsUserInterface.group.deckEditor',
      entries: [
        {
          id: 'openDeckInNewTab',
          labelKey: 'SettingsUserInterface.openDeckInNewTab.label',
          descriptionKey: 'SettingsUserInterface.openDeckInNewTab.description',
          control: { kind: 'toggle', key: 'openDeckInNewTab' },
        },
        {
          id: 'commanderSpellbookIntegration',
          labelKey: 'SettingsUserInterface.commanderSpellbookIntegration.label',
          descriptionKey: 'SettingsUserInterface.commanderSpellbookIntegration.description',
          control: {
            kind: 'select',
            key: 'commanderSpellbookIntegration',
            options: [
              {
                value: CommanderSpellbookIntegration.Unprompted,
                labelKey: 'SettingsUserInterface.commanderSpellbookIntegration.unprompted',
              },
              {
                value: CommanderSpellbookIntegration.Disabled,
                labelKey: 'SettingsUserInterface.commanderSpellbookIntegration.disabled',
              },
              {
                value: CommanderSpellbookIntegration.Enabled,
                labelKey: 'SettingsUserInterface.commanderSpellbookIntegration.enabled',
              },
              {
                value: CommanderSpellbookIntegration.Automatic,
                labelKey: 'SettingsUserInterface.commanderSpellbookIntegration.automatic',
              },
            ],
          },
        },
      ],
    },
    {
      id: 'userInterface.replay',
      titleKey: 'SettingsUserInterface.group.replay',
      entries: [
        {
          id: 'replayRewindBufferingMs',
          labelKey: 'SettingsUserInterface.replayRewindBufferingMs.label',
          descriptionKey: 'SettingsUserInterface.replayRewindBufferingMs.description',
          control: {
            kind: 'number',
            key: 'replayRewindBufferingMs',
            min: 0,
            max: 9999,
            unitKey: 'SettingsUserInterface.replayRewindBufferingMs.unit',
          },
        },
      ],
    },
  ],
};
