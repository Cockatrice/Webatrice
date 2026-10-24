import { create } from '@bufbuild/protobuf';
import { fireEvent, screen } from '@testing-library/react';
import { ServerInfo_ReportCommentSchema } from '@cockatrice/sockatrice/generated';

import { renderWithProviders } from '../../../__test-utils__';
import { makeReport } from '../__mocks__/reportState';
import ReportThread, { type ReportThreadProps } from './ReportThread';

function renderThread(overrides: Partial<ReportThreadProps> = {}) {
  const props: ReportThreadProps = {
    report: makeReport({ reportId: 1, status: 'open', description: 'he was rude' }),
    details: undefined,
    detailsFailed: false,
    reporterPrefix: '[You]',
    commentsTitle: 'Comments:',
    openPlaceholder: 'Type your comment here...',
    commentDraft: '',
    onCommentDraftChange: vi.fn(),
    onSendComment: vi.fn(),
    commentBusy: false,
    ...overrides,
  };
  renderWithProviders(<ReportThread {...props} />);
  return props;
}

describe('ReportThread', () => {
  it('shows a failed reload even when older details are cached', () => {
    renderThread({ detailsFailed: true, details: makeReport({ reportId: 1, chatLog: 'old evidence' }) });
    expect(screen.getByTestId('report-thread').textContent).toBe('Reports.thread.detailsFailed');
    expect(screen.getByTestId('report-chat-log').textContent).toBe('Reports.thread.detailsFailed');
  });

  it('shows the description and loading placeholders until details arrive', () => {
    renderThread();
    expect(screen.getByTestId('report-description').textContent).toBe('he was rude');
    expect(screen.getByTestId('report-thread').textContent).toBe('Reports.loading');
  });

  it('shows the failure line when details could not be loaded', () => {
    renderThread({ detailsFailed: true });
    expect(screen.getByTestId('report-thread').textContent).toBe('Reports.thread.detailsFailed');
  });

  it('renders the chat log and comments with moderator and reporter prefixes', () => {
    const at = BigInt(new Date(2026, 0, 2, 3, 4).getTime() / 1000);
    renderThread({
      details: makeReport({
        reportId: 1,
        reportedUserName: 'mallory',
        chatLog: '[10:00:00] mallory: hi\n[10:00:05] alice: stop',
        comments: [
          create(ServerInfo_ReportCommentSchema, { authorName: 'modA', commentText: 'Looking', isModerator: true, commentTime: at }),
          create(ServerInfo_ReportCommentSchema, { authorName: 'alice', commentText: 'Thanks', commentTime: at }),
        ],
      }),
    });
    const lines = screen.getByTestId('report-chat-log').querySelectorAll('li');
    expect([...lines].map((line) => line.textContent)).toEqual(['10:00:00mallory:hi', '10:00:05alice:stop']);
    const comments = screen.getAllByTestId('report-comment').map((c) => c.textContent);
    expect(comments).toEqual([
      'MmodAReports.thread.moderatorPrefix2026-01-02 03:04Looking',
      'Aalice[You]2026-01-02 03:04Thanks',
    ]);
  });

  it('says there are no comments yet and no chat log when the thread is empty', () => {
    renderThread({ details: makeReport({ reportId: 1 }) });
    expect(screen.getByTestId('report-thread').textContent).toBe('Reports.thread.noComments');
    expect(screen.getByTestId('report-chat-log').textContent).toBe('Reports.thread.noChatLog');
  });

  it('sends a non-blank comment on an open report', () => {
    const props = renderThread({ commentDraft: 'more info', details: makeReport({ reportId: 1 }) });
    fireEvent.click(screen.getByRole('button', { name: /Reports.thread.send/ }));
    expect(props.onSendComment).toHaveBeenCalled();
  });

  it.each(['resolved', 'dismissed'])('closes the reply box on a %s report and shows the note', (status) => {
    renderThread({ report: makeReport({ reportId: 1, status, resolutionNote: 'warned' }), commentDraft: 'x' });
    const input = screen.getByLabelText('Reports.thread.addComment') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('Reports.thread.closedPlaceholder');
    expect(screen.getByRole('button', { name: /Reports.thread.send/ })).toHaveProperty('disabled', true);
    expect(screen.getByTestId('report-resolution').textContent).toContain('warned');
  });
});
