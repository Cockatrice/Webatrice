import { performance as clock } from 'node:perf_hooks';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { markLoadTiming } from '../../utils/loadTimings';
import LoadTimings from './LoadTimings';

beforeEach(() => {
  vi.stubGlobal('performance', clock);
  clock.clearMarks();
  clock.clearMeasures();
});
afterEach(() => vi.unstubAllGlobals());

it('lists and copies timings, observes only while mounted, and handles clipboard rejection', async () => {
  const disconnect = vi.fn();
  const observe = vi.fn();
  let onEntries: () => void = () => {};
  vi.stubGlobal('PerformanceObserver', class {
    constructor(callback: () => void) {
      onEntries = callback;
    }
    observe = observe;
    disconnect = disconnect;
  });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  markLoadTiming('boot-start');
  markLoadTiming('app-render');
  const view = render(<LoadTimings />);
  expect(observe).toHaveBeenCalledWith({ entryTypes: ['measure'] });
  expect(screen.getByText(/websocket-open: pending/)).toBeInTheDocument();
  act(() => {
    markLoadTiming('websocket-open');
    onEntries();
  });
  fireEvent.click(screen.getByRole('button', { name: 'DebugLogDialog.copy' }));
  await screen.findByText('DebugLogDialog.copied');
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/boot-start: 0\.0 ms\napp-render: [\d.]+ ms\nwebsocket-open: [\d.]+ ms/));
  writeText.mockRejectedValueOnce(new Error('denied'));
  fireEvent.click(screen.getByRole('button', { name: 'DebugLogDialog.copy' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('DebugLogDialog.copyFailed'));
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
