import { MAX_SOUND_GAIN, PHASE_SOUNDS, SOUND_THEMES, SoundEngine, resolveSoundTheme, soundUrl, volumeToGain } from './SoundEngine';

class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1;
  currentTime = 5;
  preload = '';
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
}

const on = { enabled: true, theme: 'Legacy', volume: 100 };

describe('SoundEngine', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays the theme file for the event from the start, scaled from the master volume', () => {
    new SoundEngine().play('shuffle', { ...on, volume: 40 });

    expect(FakeAudio.instances).toHaveLength(1);
    const [audio] = FakeAudio.instances;
    expect(audio.src).toBe('/sounds/Legacy/shuffle.wav');
    expect(audio.volume).toBeCloseTo(0.24);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('is silent when sound is disabled', () => {
    new SoundEngine().play('shuffle', { ...on, enabled: false });
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('stops an outstanding play when sound is disabled', () => {
    const engine = new SoundEngine();
    engine.play('shuffle', on);
    engine.play('shuffle', { ...on, enabled: false });
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
  });

  it('cancels pending playback without surfacing the media abort rejection', async () => {
    let rejectPlay!: (error: DOMException) => void;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
    vi.stubGlobal('Audio', class extends FakeAudio {
      play = vi.fn(() => pending);
    });
    const engine = new SoundEngine();
    engine.play('shuffle', on);
    engine.play('shuffle', { ...on, enabled: false });
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    rejectPlay(new DOMException('Playback interrupted', 'AbortError'));
    await Promise.resolve();
  });

  it('is silent for an event the active theme has no file for', () => {
    new SoundEngine().play('roll_dice', on);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('reuses one element per file and stops the sound still playing, like desktop', () => {
    const engine = new SoundEngine();
    engine.play('shuffle', on);
    engine.play('tap_card', on);
    engine.play('shuffle', on);

    expect(FakeAudio.instances).toHaveLength(2);
    const [shuffle, tap] = FakeAudio.instances;
    expect(shuffle.pause).toHaveBeenCalledTimes(1);
    expect(tap.pause).toHaveBeenCalledTimes(1);
    expect(shuffle.play).toHaveBeenCalledTimes(2);
  });

  it('swallows an autoplay refusal', async () => {
    const engine = new SoundEngine();
    engine.play('shuffle', on);
    const [audio] = FakeAudio.instances;
    audio.play.mockReturnValueOnce(Promise.reject(new DOMException('blocked', 'NotAllowedError')));

    expect(() => engine.play('shuffle', on)).not.toThrow();
    await Promise.resolve();
  });

  it('clamps the volume into range', () => {
    new SoundEngine().play('shuffle', { ...on, volume: 250 });
    expect(FakeAudio.instances[0].volume).toBeCloseTo(MAX_SOUND_GAIN);
  });

  it('test() plays the player-join sound', () => {
    new SoundEngine().test({ ...on, theme: 'Default' });
    expect(FakeAudio.instances[0].src).toBe('/sounds/Default/player_join.wav');
  });
});

describe('sound themes', () => {
  it('falls back to the default theme for an unknown name', () => {
    expect(resolveSoundTheme('Missing')).toBe('Default');
    expect(resolveSoundTheme('toString')).toBe('Default');
    expect(soundUrl('Missing', 'buddy_join')).toBe('/sounds/Default/buddy_join.wav');
  });

  it('maps the eleven phases to desktop phase sounds in order', () => {
    expect(PHASE_SOUNDS).toHaveLength(11);
    expect(PHASE_SOUNDS[0]).toBe('untap_step');
    expect(PHASE_SOUNDS[10]).toBe('end_step');
  });

  it('declares exactly the files shipped in public/sounds', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const [theme, names] of Object.entries(SOUND_THEMES)) {
      const files = readdirSync(resolve(__dirname, '../../../public/sounds', theme))
        .filter((file) => file.endsWith('.wav'))
        .map((file) => file.replace(/\.wav$/, ''))
        .sort();
      expect([...names].sort()).toEqual(files);
    }
  });
});

describe('volumeToGain', () => {
  it.each([
    [100, 0.6],
    [60, 0.36],
    [50, 0.3],
    [0, 0],
  ])('maps the %i%% slider to a gain of %f, so the top of the slider is the old 60%%', (percent, gain) => {
    expect(volumeToGain(percent)).toBeCloseTo(gain);
  });

  it('clamps out-of-range slider values', () => {
    expect(volumeToGain(-10)).toBe(0);
    expect(volumeToGain(150)).toBeCloseTo(0.6);
  });
});
