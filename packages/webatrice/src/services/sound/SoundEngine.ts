import { DEFAULT_SOUND_THEME } from '@app/types';

export const SOUND_NAMES = [
  'untap_step', 'upkeep_step', 'draw_step', 'main_1', 'start_combat', 'attack_step', 'block_step',
  'damage_step', 'end_combat', 'main_2', 'end_step',
  'draw_card', 'play_card', 'tap_card', 'untap_card', 'shuffle', 'roll_dice', 'life_change',
  'player_join', 'player_leave', 'player_disconnect', 'player_reconnect', 'player_concede',
  'spectator_join', 'spectator_leave',
  'buddy_join', 'buddy_leave',
  'chat_mention', 'all_mention', 'private_message',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

export const PHASE_SOUNDS: readonly SoundName[] = SOUND_NAMES.slice(0, 11);

export const SOUND_THEMES: Readonly<Record<string, readonly SoundName[]>> = {
  Default: [
    'attack_step', 'buddy_join', 'buddy_leave', 'end_step', 'player_join', 'start_combat', 'tap_card',
  ],
  Legacy: [
    'all_mention', 'chat_mention', 'draw_step', 'play_card', 'player_join', 'private_message', 'shuffle',
    'tap_card', 'untap_card',
  ],
};

export const TEST_SOUND: SoundName = 'player_join';

export interface SoundOptions {
  enabled: boolean;
  theme: string;
  volume: number;
}

export const MAX_SOUND_GAIN = 0.6;

export function volumeToGain(percent: number): number {
  return (Math.min(Math.max(percent, 0), 100) / 100) * MAX_SOUND_GAIN;
}

export function resolveSoundTheme(theme: string): string {
  return Object.prototype.hasOwnProperty.call(SOUND_THEMES, theme) ? theme : DEFAULT_SOUND_THEME;
}

export function soundUrl(theme: string, name: SoundName): string | null {
  const resolved = resolveSoundTheme(theme);
  if (!SOUND_THEMES[resolved].includes(name)) {
    return null;
  }
  return `${import.meta.env.BASE_URL}sounds/${resolved}/${name}.wav`;
}

export class SoundEngine {
  private readonly elements = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  play(name: SoundName, options: SoundOptions): void {
    if (!options.enabled) {
      this.stop();
      return;
    }
    const url = soundUrl(options.theme, name);
    if (!url) {
      return;
    }

    this.stop();
    let audio = this.elements.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.elements.set(url, audio);
    }
    audio.volume = volumeToGain(options.volume);
    audio.currentTime = 0;
    this.current = audio;
    void audio.play()?.catch(() => undefined);
  }

  test(options: SoundOptions): void {
    this.play(TEST_SOUND, options);
  }

  stop(): void {
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
  }
}

export const soundEngine = new SoundEngine();
