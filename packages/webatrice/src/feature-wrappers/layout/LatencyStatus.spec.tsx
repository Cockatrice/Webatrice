import { fireEvent, screen } from '@testing-library/react';

import { connectedState, disconnectedState, renderWithProviders } from '../../__test-utils__';

import { latencyBarColor, sparklinePoints } from './LatencyGraph';
import LatencyStatus from './LatencyStatus';

function stateWithLatency(sampleCount: number, samplesMs: number[]) {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      latency: { stats: { lastMs: 40, medianMs: 30, p95Ms: 90, maxMs: 90, sampleCount }, samplesMs },
    },
  };
}

describe('LatencyStatus', () => {
  it('shows only the connection state before the first sample', () => {
    renderWithProviders(<LatencyStatus />, { preloadedState: connectedState });

    expect(screen.queryByRole('button', { name: 'LatencyStatus.ping' })).not.toBeInTheDocument();
    expect(screen.getByTitle('TopBar.connection.connected')).toBeInTheDocument();
  });

  it('names a lost connection before the first sample', () => {
    renderWithProviders(<LatencyStatus />, { preloadedState: disconnectedState });

    expect(screen.getByTitle('TopBar.connection.disconnected')).toBeInTheDocument();
  });

  it('shows the last ping with a sparkline and the stats as its tooltip', () => {
    renderWithProviders(<LatencyStatus />, { preloadedState: stateWithLatency(3, [30, 90, 40]) });

    const button = screen.getByRole('button', { name: 'LatencyStatus.ping' });
    expect(button).toHaveTextContent('LatencyStatus.short');
    expect(button).toHaveAccessibleDescription(/LatencyStatus\.median/);
    expect(button.getAttribute('title')?.split('\n')).toEqual([
      'LatencyStatus.summary',
      'LatencyStatus.last',
      'LatencyStatus.median',
      'LatencyStatus.p95',
      'LatencyStatus.max',
    ]);
    expect(screen.getByTestId('latency-sparkline').querySelector('polyline')).toHaveAttribute('points');
  });

  it('opens the larger graph with the stats on click', () => {
    renderWithProviders(<LatencyStatus />, { preloadedState: stateWithLatency(2, [30, 90]) });

    fireEvent.click(screen.getByRole('button', { name: 'LatencyStatus.ping' }));

    const details = screen.getByRole('group', { name: 'LatencyStatus.detailsName' });
    expect(details).toHaveTextContent('LatencyStatus.median');
    expect(screen.getByTestId('latency-graph').querySelectorAll('rect')).toHaveLength(2);
  });
});

describe('latencyBarColor', () => {
  it('ramps from green at 0 ms to red at 500 ms and beyond', () => {
    expect(latencyBarColor(0)).toBe('hsl(120, 100%, 50%)');
    expect(latencyBarColor(250)).toBe('hsl(60, 100%, 50%)');
    expect(latencyBarColor(500)).toBe('hsl(0, 100%, 50%)');
    expect(latencyBarColor(5000)).toBe('hsl(0, 100%, 50%)');
  });
});

describe('sparklinePoints', () => {
  it('spreads the samples across the width, higher pings drawn higher', () => {
    expect(sparklinePoints([0, 100, 50], 40, 10)).toBe('0,9 20,1 40,5');
  });

  it('scales to at least 100 ms so a quiet line stays low', () => {
    expect(sparklinePoints([10, 10], 40, 10)).toBe('0,8.2 40,8.2');
  });

  it('draws a single sample as a flat line, and nothing without samples', () => {
    expect(sparklinePoints([200], 40, 10)).toBe('0,1 40,1');
    expect(sparklinePoints([], 40, 10)).toBe('');
  });
});
