import { act } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { makeReport, reportsRootState } from '../__mocks__/reportState';
import { useReportThread, type ReportThread } from './useReportThread';

function setup() {
  const webClient = createMockWebClient();
  const added = vi.fn();
  let current!: ReportThread;
  function Probe({ selectedId }: { selectedId: number | null }) {
    current = useReportThread(selectedId, added);
    return null;
  }
  const view = renderWithProviders(<Probe selectedId={1} />, { webClient, preloadedState: reportsRootState() });
  return { ...view, get: () => current, added, session: vi.mocked(webClient.request.session, true),
    select: (selectedId: number | null) => view.rerender(<Probe selectedId={selectedId} />) };
}

it.each(['refresh', 'selection', 'other-caller', 'uncorrelated'] as const)('ignores details failure from %s', (origin) => {
  const view = setup();
  const oldId = view.session.reportDetails.mock.lastCall?.[1];
  if (origin === 'selection') {
    view.select(null); view.select(1);
  } else if (origin === 'refresh') {
    act(() => view.get().reloadDetails());
  }
  const currentId = view.session.reportDetails.mock.lastCall?.[1];
  const requestId = origin === 'other-caller' ? 'other' : origin === 'uncorrelated' ? undefined : oldId;
  act(() => view.store.dispatch(server.Actions.sessionCommandFailed({
    command: 'reportDetails', target: '1', responseCode: 7, requestId,
  })));
  expect(view.get().detailsFailed).toBe(false);
  const report = makeReport({ reportId: 1, chatLog: 'shared store evidence' });
  act(() => view.store.dispatch(server.Actions.reportDetails({ report, requestId })));
  expect(view.get().details).toBe(report);
  act(() => view.store.dispatch(server.Actions.sessionCommandFailed({
    command: 'reportDetails', target: '1', responseCode: 7, requestId: currentId,
  })));
  expect(view.get().detailsFailed).toBe(true);
  expect(view.session.reportDetails).toHaveBeenCalledTimes(origin === 'selection' || origin === 'refresh' ? 2 : 1);
});

it.each(['selection', 'refresh'] as const)('ignores old comment callbacks after %s without clearing a newer draft', (boundary) => {
  const view = setup();
  act(() => view.get().setCommentDraft('old comment'));
  act(() => view.get().sendComment());
  const old = view.session.reportAddComment.mock.lastCall!;
  if (boundary === 'selection') {
    view.select(2);
  } else {
    act(() => view.get().reloadDetails());
  }
  expect(view.get().commentBusy).toBe(false);
  act(() => view.get().setCommentDraft('new comment'));
  act(() => view.get().sendComment());
  act(() => old[3]?.(7));
  expect(view.get().commentBusy).toBe(true);
  expect(view.get().commentFailed).toBe(false);
  act(() => old[2]?.());
  expect(view.get().commentDraft).toBe('new comment');
  expect(view.get().commentBusy).toBe(true);
  expect(view.added).not.toHaveBeenCalled();
  act(() => view.session.reportAddComment.mock.lastCall?.[2]?.());
  expect(view.get().commentBusy).toBe(false);
  expect(view.get().commentDraft).toBe('');
  expect(view.added).toHaveBeenCalledTimes(1);
  act(() => old[3]?.(7));
  expect(view.get().commentFailed).toBe(false);
});

it('ignores a comment callback after leaving the view', () => {
  const view = setup();
  act(() => view.get().setCommentDraft('draft'));
  act(() => view.get().sendComment());
  const old = view.session.reportAddComment.mock.lastCall!;
  view.unmount();
  act(() => old[2]?.());
  expect(view.added).not.toHaveBeenCalled();
});
