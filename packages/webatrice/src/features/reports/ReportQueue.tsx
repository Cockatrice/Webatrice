import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Film, Gavel, LogIn, RefreshCw, UserCheck } from 'lucide-react';

import { rooms } from '@cockatrice/datatrice';
import { Button, IconButton, TextInput } from '@app/components';
import { AlertDialog, PromptDialog } from '@app/dialogs';
import { StaffConsole, StaffDrawer, StaffHeader, StaffTabs, StaffToolGuard } from '@app/feature-wrappers/staff';
import { useAppDispatch, useAppSelector } from '@app/store';

import { ReportCategoryTag, ReportStatusBadge } from './components/ReportBadges';
import { ReportStatsDetails, ReportStatsLine } from './components/ReportStatsPanel';
import ReportTable, { QUEUE_COLUMNS } from './components/ReportTable';
import ReportThread from './components/ReportThread';
import ReportUserContextPanel from './components/ReportUserContextPanel';
import { listStatusText } from './components/reportUi';
import { useMinuteClock } from './hooks/useMinuteClock';
import { REPORT_QUEUE_VIEWS } from './hooks/reportQueueView';
import { useReportQueue } from './hooks/useReportQueue';
import { formatReportTime } from './reportFormat';

const ReportQueueContent = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const joinError = useAppSelector(rooms.Selectors.getJoinGameError);
  const q = useReportQueue();
  const now = useMinuteClock();
  const [statsShown, setStatsShown] = useState(false);
  const report = q.selected;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col" data-testid="report-queue">
        <StaffHeader
          title={t('Reports.queue.title')}
          subtitle={<ReportStatsLine state={q.statsState} />}
          actions={(
            <>
              <TextInput
                type="search"
                aria-label={t('Reports.queue.searchPlaceholder')}
                placeholder={t('Reports.queue.searchPlaceholder')}
                wrapperClassName="w-[240px]"
                value={q.search}
                onChange={(e) => q.setSearch(e.target.value)}
              />
              <IconButton
                label={t('Reports.stats.title')}
                active={statsShown}
                aria-expanded={statsShown}
                onClick={() => setStatsShown(!statsShown)}
              >
                <BarChart3 size={15} aria-hidden />
              </IconButton>
              <IconButton label={t('Reports.refresh')} onClick={q.refresh} disabled={q.loadState === 'loading'}>
                <RefreshCw size={15} aria-hidden />
              </IconButton>
            </>
          )}
        />
        {statsShown && <ReportStatsDetails />}
        <StaffTabs
          label={t('Reports.queue.filter')}
          value={q.view}
          onChange={q.setView}
          items={REPORT_QUEUE_VIEWS.map((view) => ({ value: view, label: t(`Reports.view.${view}`), count: q.viewCounts[view] }))}
        />
        <div className="flex min-h-0 flex-1">
          <ReportTable
            reports={q.reports}
            columns={QUEUE_COLUMNS}
            selectedId={q.selectedId}
            onSelect={q.select}
            onEscape={() => q.select(null)}
            label={t('Reports.queue.title')}
            footer={(
              <span role="status" data-testid="report-queue-status">
                {q.loadState === 'ready'
                  ? t('Reports.queue.shownOfTotal', { shown: q.reports.length, total: Math.max(q.totalCount, q.loadedCount) })
                  : listStatusText(t, q.loadState, q.reports.length)}
              </span>
            )}
          />
          {report && (
            <StaffDrawer
              label={t('Reports.drawer.label', { id: report.reportId })}
              onClose={() => q.select(null)}
              title={(
                <>
                  <span className="font-display text-[17px] font-semibold text-text-primary">#{report.reportId}</span>
                  <ReportCategoryTag category={report.category} />
                  <ReportStatusBadge status={report.status} />
                </>
              )}
              subtitle={(
                <>
                  {t('Reports.drawer.subtitle', {
                    reporter: report.reporterName,
                    reported: report.reportedUserName,
                    time: formatReportTime(report.reportTime),
                  })}
                  {report.gameId > 0 && ` · ${t('Reports.drawer.game', { gameId: report.gameId })}`}
                </>
              )}
              actions={(
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<UserCheck size={13} aria-hidden />}
                    disabled={!q.actions.canAssign}
                    onClick={q.assign}
                  >
                    {t('Reports.queue.assign')}
                  </Button>
                  <Button size="sm" icon={<Gavel size={13} aria-hidden />} disabled={!q.actions.canResolve} onClick={q.resolve}>
                    {t('Reports.queue.resolve')}
                  </Button>
                  <Button size="sm" variant="quiet" disabled={!q.actions.canResolve} onClick={() => q.promptResolve(false)}>
                    {t('Reports.queue.resolveWithNote')}
                  </Button>
                  <Button size="sm" variant="quiet" disabled={!q.actions.canResolve} onClick={() => q.promptResolve(true)}>
                    {t('Reports.queue.dismiss')}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    className="ml-auto"
                    icon={<Film size={13} aria-hidden />}
                    disabled={!q.actions.canViewReplay}
                    onClick={q.viewReplay}
                  >
                    {t('Reports.queue.viewReplay')}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<LogIn size={13} aria-hidden />}
                    disabled={!q.actions.canJoinGame}
                    onClick={q.joinGame}
                  >
                    {t('Reports.queue.joinGame')}
                  </Button>
                  <span role="status" data-testid="report-action-status" className="basis-full text-[12px] text-text-muted empty:hidden">
                    {q.actionMessage ? t(`Reports.queue.${q.actionMessage}`) : ''}
                  </span>
                </>
              )}
            >
              <ReportThread
                report={report}
                details={q.thread.details}
                detailsFailed={q.thread.detailsFailed}
                reporterPrefix={t('Reports.thread.reporterPrefix')}
                commentsTitle={t('Reports.thread.threadWith', { name: report.reporterName })}
                openPlaceholder={t('Reports.thread.replyPlaceholder', { name: report.reporterName })}
                commentDraft={q.thread.commentDraft}
                onCommentDraftChange={q.thread.setCommentDraft}
                onSendComment={q.thread.sendComment}
                commentBusy={q.thread.commentBusy}
                evidenceNote={t('Reports.thread.chatCaveat', { name: report.reporterName })}
                userContext={report.reportedUserName
                  ? <ReportUserContextPanel userName={report.reportedUserName} failed={q.userInfoFailed} now={now} />
                  : undefined}
              />
              {q.thread.commentFailed && <p role="alert" className="text-[12px] text-danger">{t('Reports.thread.commentFailed')}</p>}
            </StaffDrawer>
          )}
        </div>
      </div>

      <PromptDialog
        isOpen={q.resolvePrompt !== null}
        title={q.resolvePrompt?.dismissed ? t('Reports.queue.dismissTitle') : t('Reports.queue.resolveTitle')}
        label={q.resolvePrompt?.dismissed ? t('Reports.queue.dismissNoteLabel') : t('Reports.queue.resolveNoteLabel')}
        submitLabel={t('Reports.queue.ok')}
        onSubmit={q.submitResolvePrompt}
        onCancel={q.cancelResolvePrompt}
      />
      <AlertDialog
        isOpen={joinError !== null}
        title={t('Reports.queue.joinFailedTitle')}
        message={joinError?.message ?? ''}
        onDismiss={() => dispatch(rooms.Actions.clearJoinGameError())}
      />
    </>
  );
};

const ReportQueue = () => (
  <StaffConsole>
    <StaffToolGuard tool="reports">
      <ReportQueueContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default ReportQueue;
