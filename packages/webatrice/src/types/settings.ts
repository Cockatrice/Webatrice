import { DEFAULT_PLAYMAT_SETTINGS, type PlaymatSettings } from './playmats';

export class Setting {
  user: string;
  version?: number;
  // Override map for keyboard shortcuts. Keys are ActionId strings (kept loose here to
  // avoid coupling this types module to the shortcuts module). Absent = use defaults.
  shortcuts?: Record<string, string[]>;
  replayFastForwardSpeed?: number;
  replaySkipEmptySections?: boolean;

  autoConnect: boolean;
  startupTab: StartupTab;
  startupServer: string;
  startupRoom: string;

  notifyAboutMissingFeatures: boolean;

  language: string;

  clearDebugLogOnClose: boolean;

  themeMode: ThemeMode;
  themeName: ThemeName;
  signInCardArt: boolean;
  playmatSettings: PlaymatSettings;

  showShortcutsInMenus: boolean;

  zoneBackgrounds: ZoneBackgrounds;

  bumpSetsWithCardsInDeckToTop: boolean;

  displayCardNames: boolean;
  autoRotateSidewaysLayoutCards: boolean;
  scaleCards: boolean;
  roundCardCorners: boolean;
  maxFontSizeForCards: number;

  verticalCardOverlapPercent: number;
  cardViewInitialRowsMax: number;
  cardViewExpandedRowsMax: number;

  cardCounterColorA: string;
  cardCounterColorB: string;
  cardCounterColorC: string;
  cardCounterColorD: string;
  cardCounterColorE: string;
  cardCounterColorF: string;

  horizontalHand: boolean;
  leftJustifiedHand: boolean;

  invertVerticalCoordinate: boolean;
  minPlayersForMultiColumnLayout: number;

  doubleClickToPlay: boolean;
  clickPlaysAllSelected: boolean;
  playToStack: boolean;
  doNotDeleteArrowsInSubPhases: boolean;
  closeEmptyCardView: boolean;
  focusCardViewSearchBar: boolean;
  annotateTokens: boolean;
  showDragSelectionCount: boolean;
  showTotalSelectionCount: boolean;
  keepGameChatFocus: boolean;

  tapAnimation: boolean;
  arrowDrawAnimation: boolean;
  lifeCounterAnimations: boolean;
  battlefieldFlash: boolean;
  animationsChosen: boolean;

  openDeckInNewTab: boolean;
  commanderSpellbookIntegration: CommanderSpellbookIntegration;

  replayRewindBufferingMs: number;

  notificationsEnabled: boolean;
  spectatorNotificationsEnabled: boolean;
  buddyConnectNotificationsEnabled: boolean;
  playBadge: PlayBadgeMode;

  chatMention: boolean;
  chatMentionColor: string;
  chatMentionForeground: boolean;
  chatMentionCompleter: boolean;
  chatHighlightWords: string;
  chatHighlightColor: string;
  chatHighlightForeground: boolean;
  ignoreUnregisteredUsers: boolean;
  ignoreUnregisteredUserMessages: boolean;
  ignoreNonBuddyUserMessages: boolean;
  ignoreAllPrivateMessages: boolean;
  showMessagePopups: boolean;
  showMentionPopups: boolean;
  roomHistory: boolean;
  useGameTime: boolean;

  messageMacros: readonly string[];

  soundEnabled: boolean;
  soundTheme: string;
  masterVolume: number;
}

export const APP_USER = '*app';

export type ZoneBackgroundZone = 'hand' | 'stack' | 'table' | 'playerInfo';

export interface ZoneBackground {
  cardName: string;
  cardProviderId: string;
  params: { marginPctL: number; marginPctR: number; verticalOffset: number; zoom: number };
}

export type ZoneBackgrounds = Readonly<Partial<Record<ZoneBackgroundZone, ZoneBackground>>>;

export enum ThemeMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export enum ThemeName {
  Midnight = 'midnight',
  Graphite = 'graphite',
  Carbon = 'carbon',
}

export enum StartupTab {
  Server = 'server',
  ServerRoom = 'serverRoom',
  DeckStorage = 'deckStorage',
  Replays = 'replays',
}

export enum PlayBadgeMode {
  Mentions = 'mentions',
  All = 'all',
}

export enum CommanderSpellbookIntegration {
  Disabled = 'disabled',
  Enabled = 'enabled',
  Automatic = 'automatic',
  Unprompted = 'unprompted',
}

export type Preferences = Omit<Setting, 'user' | 'version' | 'shortcuts'>;
export type PreferenceKey = keyof Preferences;

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
export type BooleanPreferenceKey = KeysOfType<Preferences, boolean>;
export type NumberPreferenceKey = KeysOfType<Preferences, number>;
export type StringPreferenceKey = KeysOfType<Preferences, string>;

export const DEFAULT_SOUND_THEME = 'Default';
export const DEFAULT_CHAT_COLOR = 'A6120D';

export const CARD_COUNTER_COLOR_KEYS = [
  'cardCounterColorA',
  'cardCounterColorB',
  'cardCounterColorC',
  'cardCounterColorD',
  'cardCounterColorE',
  'cardCounterColorF',
] as const;

export const PREFERENCE_DEFAULTS: Readonly<Preferences> = Object.freeze({
  autoConnect: false,
  playmatSettings: DEFAULT_PLAYMAT_SETTINGS,
  startupTab: StartupTab.Server,
  startupServer: '',
  startupRoom: '',

  notifyAboutMissingFeatures: true,

  language: '',

  clearDebugLogOnClose: false,

  themeMode: ThemeMode.System,
  themeName: ThemeName.Graphite,

  signInCardArt: true,

  showShortcutsInMenus: true,

  zoneBackgrounds: Object.freeze({}),

  bumpSetsWithCardsInDeckToTop: true,

  displayCardNames: true,
  autoRotateSidewaysLayoutCards: true,
  scaleCards: true,
  roundCardCorners: true,
  maxFontSizeForCards: 12,

  verticalCardOverlapPercent: 33,
  cardViewInitialRowsMax: 14,
  cardViewExpandedRowsMax: 20,

  cardCounterColorA: 'FF6969',
  cardCounterColorB: 'FFFF69',
  cardCounterColorC: '69FF69',
  cardCounterColorD: '69FFFF',
  cardCounterColorE: '6969FF',
  cardCounterColorF: 'FF69FF',

  horizontalHand: true,
  leftJustifiedHand: false,

  invertVerticalCoordinate: false,
  minPlayersForMultiColumnLayout: 4,

  doubleClickToPlay: true,
  clickPlaysAllSelected: true,
  playToStack: true,
  doNotDeleteArrowsInSubPhases: true,
  closeEmptyCardView: true,
  focusCardViewSearchBar: true,
  annotateTokens: false,
  showDragSelectionCount: true,
  showTotalSelectionCount: true,
  keepGameChatFocus: false,

  tapAnimation: true,
  arrowDrawAnimation: true,
  lifeCounterAnimations: true,
  battlefieldFlash: true,
  animationsChosen: false,

  openDeckInNewTab: false,
  commanderSpellbookIntegration: CommanderSpellbookIntegration.Unprompted,

  replayRewindBufferingMs: 200,

  notificationsEnabled: true,
  spectatorNotificationsEnabled: false,
  buddyConnectNotificationsEnabled: true,
  playBadge: PlayBadgeMode.Mentions,

  chatMention: true,
  chatMentionColor: DEFAULT_CHAT_COLOR,
  chatMentionForeground: true,
  chatMentionCompleter: true,
  chatHighlightWords: '',
  chatHighlightColor: DEFAULT_CHAT_COLOR,
  chatHighlightForeground: true,
  ignoreUnregisteredUsers: false,
  ignoreUnregisteredUserMessages: false,
  ignoreNonBuddyUserMessages: false,
  ignoreAllPrivateMessages: false,
  showMessagePopups: true,
  showMentionPopups: true,
  roomHistory: true,
  useGameTime: false,

  messageMacros: Object.freeze([]),

  soundEnabled: false,
  soundTheme: DEFAULT_SOUND_THEME,
  masterVolume: 50,
});

export const SETTINGS_VERSION = 5;
