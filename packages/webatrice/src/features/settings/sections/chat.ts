import { MessageSquare } from 'lucide-react';

import HighlightWordsField from '../controls/HighlightWordsField';
import MessageMacrosEditor from '../controls/MessageMacrosEditor';
import { SettingsSectionId, type SettingsSection } from '../registry';

export const chatSection: SettingsSection = {
  id: SettingsSectionId.Chat,
  titleKey: 'Settings.section.chat',
  icon: MessageSquare,
  groups: [
    {
      id: 'chat.macros',
      titleKey: 'SettingsChat.group.macros',
      entries: [
        {
          id: 'messageMacros',
          labelKey: 'SettingsChat.macros.label',
          descriptionKey: 'SettingsChat.macros.description',
          control: { kind: 'custom', component: MessageMacrosEditor, keys: ['messageMacros'], layout: 'block' },
        },
      ],
    },
    {
      id: 'chat.settings',
      titleKey: 'SettingsChat.group.chat',
      entries: [
        {
          id: 'chatMention',
          labelKey: 'SettingsChat.chatMention.label',
          descriptionKey: 'SettingsChat.chatMention.description',
          control: { kind: 'toggle', key: 'chatMention' },
        },
        {
          id: 'chatMentionColor',
          labelKey: 'SettingsChat.chatMentionColor.label',
          control: { kind: 'color', key: 'chatMentionColor' },
          dependsOn: 'chatMention',
        },
        {
          id: 'chatMentionForeground',
          labelKey: 'SettingsChat.invertTextColor.label',
          descriptionKey: 'SettingsChat.invertTextColor.description',
          control: { kind: 'toggle', key: 'chatMentionForeground' },
          dependsOn: 'chatMention',
        },
        {
          id: 'chatMentionCompleter',
          labelKey: 'SettingsChat.chatMentionCompleter.label',
          descriptionKey: 'SettingsChat.chatMentionCompleter.description',
          control: { kind: 'toggle', key: 'chatMentionCompleter' },
        },
        {
          id: 'ignoreUnregisteredUsers',
          labelKey: 'SettingsChat.ignoreUnregisteredUsers.label',
          control: { kind: 'toggle', key: 'ignoreUnregisteredUsers' },
        },
        {
          id: 'ignoreUnregisteredUserMessages',
          labelKey: 'SettingsChat.ignoreUnregisteredUserMessages.label',
          descriptionKey: 'SettingsChat.privateMessageFilter.description',
          control: { kind: 'toggle', key: 'ignoreUnregisteredUserMessages' },
        },
        {
          id: 'ignoreNonBuddyUserMessages',
          labelKey: 'SettingsChat.ignoreNonBuddyUserMessages.label',
          descriptionKey: 'SettingsChat.privateMessageFilter.description',
          control: { kind: 'toggle', key: 'ignoreNonBuddyUserMessages' },
        },
        {
          id: 'showMessagePopups',
          labelKey: 'SettingsChat.showMessagePopups.label',
          control: { kind: 'toggle', key: 'showMessagePopups' },
        },
        {
          id: 'showMentionPopups',
          labelKey: 'SettingsChat.showMentionPopups.label',
          control: { kind: 'toggle', key: 'showMentionPopups' },
        },
        {
          id: 'roomHistory',
          labelKey: 'SettingsChat.roomHistory.label',
          control: { kind: 'toggle', key: 'roomHistory' },
        },
        {
          id: 'ignoreAllPrivateMessages',
          labelKey: 'SettingsChat.ignoreAllPrivateMessages.label',
          descriptionKey: 'SettingsChat.ignoreAllPrivateMessages.description',
          control: { kind: 'toggle', key: 'ignoreAllPrivateMessages' },
        },
        {
          id: 'useGameTime',
          labelKey: 'SettingsChat.useGameTime.label',
          descriptionKey: 'SettingsChat.useGameTime.description',
          control: { kind: 'toggle', key: 'useGameTime' },
        },
      ],
    },
    {
      id: 'chat.highlight',
      titleKey: 'SettingsChat.group.highlight',
      entries: [
        {
          id: 'chatHighlightWords',
          labelKey: 'SettingsChat.highlightWords.label',
          descriptionKey: 'SettingsChat.highlightWords.description',
          control: { kind: 'custom', component: HighlightWordsField, keys: ['chatHighlightWords'] },
        },
        {
          id: 'chatHighlightColor',
          labelKey: 'SettingsChat.chatHighlightColor.label',
          control: { kind: 'color', key: 'chatHighlightColor' },
        },
        {
          id: 'chatHighlightForeground',
          labelKey: 'SettingsChat.invertTextColor.label',
          descriptionKey: 'SettingsChat.invertTextColor.description',
          control: { kind: 'toggle', key: 'chatHighlightForeground' },
        },
      ],
    },
  ],
};
