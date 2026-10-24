import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

import { ServerCapability } from '@cockatrice/datatrice';
import { AuthGuard, CapabilityGuard, IconButton } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { StaffDrawer, StaffHeader } from '@app/feature-wrappers/staff';

import { ReportCategoryTag, ReportStatusBadge } from './components/ReportBadges';
import ReportTable, { MY_REPORT_COLUMNS } from './components/ReportTable';
import ReportThread from './components/ReportThread';
import { listStatusText } from './components/reportUi';
import { useMyReports } from './hooks/useMyReports';
import { formatReportTime } from './reportFormat';

const MyReportsContent = () => {
  const { t } = useTranslation();
  const { reports, loadState, refresh, selectedId, selected, select, thread } = useMyReports();

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base" data-testid="my-reports">
      <StaffHeader
        title={t('Reports.mine.title')}
        subtitle={t('Reports.mine.subtitle')}
        actions={(
          <IconButton label={t('Reports.refresh')} onClick={refresh} disabled={loadState === 'loading'}>
            <RefreshCw size={15} aria-hidden />
          </IconButton>
        )}
      />
      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <ReportTable
          reports={reports}
          columns={MY_REPORT_COLUMNS}
          selectedId={selectedId}
          onSelect={select}
          onEscape={() => select(null)}
          label={t('Reports.mine.title')}
          footer={(
            <span role="status" data-testid="report-list-status">{listStatusText(t, loadState, reports.length)}</span>
          )}
        />
        {selected && (
          <StaffDrawer
            label={t('Reports.drawer.label', { id: selected.reportId })}
            onClose={() => select(null)}
            title={(
              <>
                <span className="font-display text-[17px] font-semibold text-text-primary">#{selected.reportId}</span>
                <ReportCategoryTag category={selected.category} />
                <ReportStatusBadge status={selected.status} />
              </>
            )}
            subtitle={t('Reports.drawer.mineSubtitle', {
              reported: selected.reportedUserName,
              time: formatReportTime(selected.reportTime),
            })}
          >
            <ReportThread
              report={selected}
              details={thread.details}
              detailsFailed={thread.detailsFailed}
              reporterPrefix={t('Reports.thread.youPrefix')}
              commentsTitle={t('Reports.thread.comments')}
              openPlaceholder={t('Reports.thread.commentPlaceholder')}
              commentDraft={thread.commentDraft}
              onCommentDraftChange={thread.setCommentDraft}
              onSendComment={thread.sendComment}
              commentBusy={thread.commentBusy}
            />
            {thread.commentFailed && <p role="alert" className="text-[12px] text-danger">{t('Reports.thread.commentFailed')}</p>}
          </StaffDrawer>
        )}
      </div>
    </div>
  );
};

const MyReports = () => (
  <Layout>
    <AuthGuard />
    <CapabilityGuard capability={ServerCapability.REPORTS}>
      <MyReportsContent />
    </CapabilityGuard>
  </Layout>
);

export default MyReports;
