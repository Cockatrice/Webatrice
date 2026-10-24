import { fireEvent, screen, within } from '@testing-library/react';

import { BIG_SKIP_MS, SMALL_SKIP_MS } from '@app/services';

import { renderWithProviders } from '../../__test-utils__';
import ReplayControls from './ReplayControls';
import type { ReplayPlayback } from './useReplayPlayback';

function makePlayback(overrides: Partial<ReplayPlayback> = {}): ReplayPlayback {
  return {
    state: {
      currentTime: 65000,
      maxTime: 600000,
      processedEvents: 3,
      totalEvents: 10,
      playing: false,
      finished: false,
      timeScaleFactor: 1,
      skipEmptySections: false,
    },
    timeline: [0, 1000, 65000, 600000],
    fastForward: false,
    fastForwardSpeed: 10,
    togglePlay: vi.fn(),
    toggleFastForward: vi.fn(),
    seek: vi.fn(),
    skipBy: vi.fn(),
    setFastForwardSpeed: vi.fn(),
    setSkipEmptySections: vi.fn(),
    ...overrides,
  };
}

describe('ReplayControls', () => {
  it('shows the position against the replay length', () => {
    renderWithProviders(<ReplayControls playback={makePlayback()} />);
    expect(screen.getByTestId('replay-time')).toHaveTextContent('1:05 / 10:00');
  });

  it('toggles play and pause', () => {
    const playback = makePlayback();
    const { rerender } = renderWithProviders(<ReplayControls playback={playback} />);

    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.play' }));
    expect(playback.togglePlay).toHaveBeenCalled();

    rerender(<ReplayControls playback={{ ...playback, state: { ...playback.state, playing: true } }} />);
    expect(screen.getByRole('button', { name: 'GameReplay.controls.pause' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('skips by desktop\'s small and big amounts in both directions', () => {
    const playback = makePlayback();
    renderWithProviders(<ReplayControls playback={playback} />);

    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.skipForward' }));
    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.skipBackward' }));
    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.skipForwardBig' }));
    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.skipBackwardBig' }));

    expect(vi.mocked(playback.skipBy).mock.calls).toEqual([[SMALL_SKIP_MS], [-SMALL_SKIP_MS], [BIG_SKIP_MS], [-BIG_SKIP_MS]]);
  });

  it('toggles fast forward', () => {
    const playback = makePlayback({ fastForward: true });
    renderWithProviders(<ReplayControls playback={playback} />);

    const button = screen.getByRole('button', { name: 'GameReplay.controls.fastForward' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(playback.toggleFastForward).toHaveBeenCalled();
  });

  it('changes skip-empty and a clamped fast-forward speed from the quick settings', () => {
    const playback = makePlayback();
    renderWithProviders(<ReplayControls playback={playback} />);

    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.settings' }));
    const popover = screen.getByRole('presentation');

    fireEvent.click(within(popover).getByRole('checkbox', { name: 'GameReplay.settings.skipEmptySections' }));
    expect(playback.setSkipEmptySections).toHaveBeenCalledWith(true);

    const speed = within(popover).getByLabelText('GameReplay.settings.fastForwardSpeed');
    fireEvent.change(speed, { target: { value: '250' } });
    fireEvent.blur(speed);
    expect(playback.setFastForwardSpeed).toHaveBeenCalledWith(99.9);
  });

  it('applies an in-range fast-forward speed as it is typed, and clamps on Enter', () => {
    const playback = makePlayback();
    renderWithProviders(<ReplayControls playback={playback} />);
    fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.settings' }));
    const speed = within(screen.getByRole('presentation')).getByLabelText('GameReplay.settings.fastForwardSpeed');

    fireEvent.change(speed, { target: { value: '25' } });
    expect(playback.setFastForwardSpeed).toHaveBeenLastCalledWith(25);

    fireEvent.change(speed, { target: { value: '0.5' } });
    expect(playback.setFastForwardSpeed).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(speed, { key: 'Enter' });
    expect(playback.setFastForwardSpeed).toHaveBeenLastCalledWith(1);
  });

  it('seeks to the clicked point of the timeline', () => {
    const playback = makePlayback();
    renderWithProviders(<ReplayControls playback={playback} />);
    const timeline = screen.getByTestId('replay-timeline');
    vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect);

    fireEvent.click(timeline, { clientX: 200 });

    expect(playback.seek).toHaveBeenCalledWith(150000);
    expect(timeline).toHaveAttribute('aria-valuenow', '65000');
    expect(timeline).toHaveAttribute('aria-valuemax', '600000');
  });

  it('seeks from the keyboard once the timeline is focused', () => {
    const playback = makePlayback();
    renderWithProviders(<ReplayControls playback={playback} />);
    const timeline = screen.getByRole('slider', { name: 'GameReplay.timeline.label' });
    expect(timeline).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(timeline, { key: 'ArrowRight' });
    expect(playback.seek).toHaveBeenLastCalledWith(66000);
    fireEvent.keyDown(timeline, { key: 'PageDown' });
    expect(playback.seek).toHaveBeenLastCalledWith(55000);
    fireEvent.keyDown(timeline, { key: 'Home' });
    expect(playback.seek).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(timeline, { key: 'End' });
    expect(playback.seek).toHaveBeenLastCalledWith(600000);
    fireEvent.keyDown(timeline, { key: 'a' });
    expect(playback.seek).toHaveBeenCalledTimes(4);
  });
});
