import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import ReplayTimeline from './ReplayTimeline';

it('renders a bounded silhouette for a long replay and still seeks across its full duration', () => {
  const maxTime = 1_000_000_000;
  const onSeek = vi.fn();
  renderWithProviders(<ReplayTimeline timeline={[0, maxTime]} currentTime={0} maxTime={maxTime} onSeek={onSeek} />);

  const timeline = screen.getByRole('slider');
  const svg = timeline.querySelector('svg')!;
  expect(Number(svg.getAttribute('viewBox')!.split(' ')[2])).toBeLessThanOrEqual(2048);
  expect(svg.querySelector('path')!.getAttribute('d')!.split(' L').length).toBeLessThanOrEqual(2050);
  fireEvent.keyDown(timeline, { key: 'End' });
  expect(onSeek).toHaveBeenCalledWith(maxTime);
});

it('draws a tick and a label for each turn mark, marking played turns', () => {
  renderWithProviders(
    <ReplayTimeline
      timeline={[0, 60000]}
      currentTime={30000}
      maxTime={60000}
      onSeek={vi.fn()}
      turnMarks={[{ turn: 1, time: 6000 }, { turn: 2, time: 45000 }]}
    />,
  );

  expect(screen.getAllByTestId('replay-turn-tick').map((tick) => tick.style.left)).toEqual(['10%', '75%']);
  const labels = within(screen.getByRole('list', { name: 'GameReplay.timeline.turns' })).getAllByRole('listitem');
  expect(labels.map((label) => label.textContent)).toEqual(['GameReplay.timeline.turn', 'GameReplay.timeline.turn']);
  expect(labels[0].className).toContain('replay-timeline__turn--played');
  expect(labels[1].className).not.toContain('replay-timeline__turn--played');
});
