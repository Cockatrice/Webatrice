import type { ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Response_ResponseCode, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import type { RootState } from '../../store';
import { ReportChatScope, ReportUserProvider, useReportUser } from './ReportUserContext';

const REGISTERED = ServerInfo_User_UserLevelFlag.IsRegistered;

function stateFor(version: string, userLevel = REGISTERED): Partial<RootState> {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as RootState['server']),
      info: { message: null, name: 'Test Server', version },
      user: makeUser({ name: 'alice', userLevel }),
    },
  };
}

const SERVER_31 = '3.1.0 (2026-08-21)';
const SERVER_30 = '3.0.0 ()';

function Probe({ target, gameId, chatContext }: { target: string; gameId?: number; chatContext?: string }) {
  const { canReportUser, openReportUser } = useReportUser();
  return (
    <div>
      <span data-testid="can-report">{String(canReportUser(target))}</span>
      <button type="button" onClick={() => openReportUser({ userName: target, gameId, chatContext })}>open</button>
    </div>
  );
}

function renderProbe(state: Partial<RootState>, probe: ReactElement, scope?: { gameId?: number; log?: string }) {
  const webClient = createMockWebClient();
  const tree = scope
    ? <ReportChatScope gameId={scope.gameId} getChatContext={scope.log ? () => scope.log! : undefined}>{probe}</ReportChatScope>
    : probe;
  const utils = renderWithProviders(<ReportUserProvider>{tree}</ReportUserProvider>, { preloadedState: state, webClient });
  return { ...utils, report: webClient.request.session.report as unknown as ReturnType<typeof vi.fn> };
}

describe('useReportUser permissions', () => {
  it('offers reporting another user on a 3.1 server to a registered user', () => {
    renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    expect(screen.getByTestId('can-report').textContent).toBe('true');
  });

  it('hides reporting on a 3.0 server', () => {
    renderProbe(stateFor(SERVER_30), <Probe target="mallory" />);
    expect(screen.getByTestId('can-report').textContent).toBe('false');
  });

  it('hides reporting from guests', () => {
    renderProbe(stateFor(SERVER_31, 0), <Probe target="mallory" />);
    expect(screen.getByTestId('can-report').textContent).toBe('false');
  });

  it('never offers reporting yourself', () => {
    renderProbe(stateFor(SERVER_31), <Probe target="alice" />);
    expect(screen.getByTestId('can-report').textContent).toBe('false');
  });
});

describe('ReportUserDialog', () => {
  it.each(['  original log\nsecond line  ', '  \n  ', ''])('sends the trimmed read-only prefill %j', async (log) => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" chatContext={log} />);
    fireEvent.click(screen.getByText('open'));
    const field = screen.getByLabelText('ReportUserDialog.chatGroup');
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveValue(log.trim());
    expect(field).toHaveAttribute('placeholder', 'ReportUserDialog.chatEmpty');
    submitDescription('Details');
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    expect(report.mock.calls[0][0].chatLog).toBe(log.trim() || undefined);
  });

  function submitDescription(text: string) {
    fireEvent.change(screen.getByLabelText('ReportUserDialog.descriptionGroup'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'ReportUserDialog.submit' }));
  }

  it('takes the game and chat context from the nearest scope', async () => {
    renderProbe(stateFor(SERVER_31), <Probe target="mallory" />, { gameId: 42, log: '[10:00:00] mallory: rude' });
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('report-reported-user').textContent).toBe('mallory');
    expect(screen.getByText('42')).toBeTruthy();
    expect((screen.getByLabelText('ReportUserDialog.chatGroup') as HTMLTextAreaElement).value)
      .toBe('[10:00:00] mallory: rude');
  });

  it('lets explicit params win over the scope', () => {
    renderProbe(stateFor(SERVER_31), <Probe target="mallory" gameId={7} chatContext="own log" />, { gameId: 42, log: 'scoped' });
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByText('7')).toBeTruthy();
    expect((screen.getByLabelText('ReportUserDialog.chatGroup') as HTMLTextAreaElement).value).toBe('own log');
  });

  it('requires a description before asking for confirmation', async () => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByRole('button', { name: 'ReportUserDialog.submit' }));
    expect(await screen.findByText('ReportUserDialog.validation.description')).toBeTruthy();
    expect(screen.queryByText('ReportUserDialog.confirmTitle')).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it('confirms, then sends Command_Report with the typed game id and the chat log', async () => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" chatContext="  log line  " />);
    fireEvent.click(screen.getByText('open'));
    fireEvent.change(screen.getByLabelText('ReportUserDialog.category'), { target: { value: 'spam' } });
    fireEvent.change(screen.getByLabelText('ReportUserDialog.gameId'), { target: { value: '15' } });
    submitDescription('  sent me ads  ');

    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toEqual({
      reportedUser: 'mallory',
      category: 'spam',
      description: 'sent me ads',
      gameId: 15,
      chatLog: 'log line',
    });
    expect(screen.getByText('ReportUserDialog.submitting').closest('button')).toHaveProperty('disabled', true);
  });

  it('omits the game id and chat log when there are none', async () => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    fireEvent.click(screen.getByText('open'));
    submitDescription('x');
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    expect(report.mock.calls[0][0]).toMatchObject({ gameId: undefined, chatLog: undefined, category: 'cheating' });
  });

  it('declining the confirmation sends nothing', async () => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    fireEvent.click(screen.getByText('open'));
    submitDescription('x');
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmNo' }));
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    [Response_ResponseCode.RespTooManyRequests, 'ReportUserDialog.error.tooManyRequests'],
    [Response_ResponseCode.RespNameNotFound, 'ReportUserDialog.error.nameNotFound'],
    [Response_ResponseCode.RespInternalError, 'ReportUserDialog.error.generic'],
  ])('shows the desktop message for response code %s and re-enables submit', async (code, message) => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    fireEvent.click(screen.getByText('open'));
    submitDescription('x');
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    const onFailure = report.mock.calls[0][2];
    onFailure(code);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', message);
    expect(screen.getByRole('button', { name: 'ReportUserDialog.submit' })).toHaveProperty('disabled', false);
  });

  it('confirms success and closes when acknowledged', async () => {
    const { report } = renderProbe(stateFor(SERVER_31), <Probe target="mallory" />);
    fireEvent.click(screen.getByText('open'));
    submitDescription('x');
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    report.mock.calls[0][1]();
    expect(await screen.findByText('ReportUserDialog.submittedMessage')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByTestId('report-reported-user')).toBeNull());
  });
});
