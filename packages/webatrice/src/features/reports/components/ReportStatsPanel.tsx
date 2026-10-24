import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import { sectionLabelClass } from '@app/feature-wrappers/staff';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import type { ReportListLoadState } from '../hooks/useReportListLoad';
import { weekChange } from '../reportFormat';
import { useReportLabels } from './ReportBadges';

export function ReportStatsLine({ state }: { state: ReportListLoadState }) {
  const { t } = useTranslation();
  const stats = useAppSelector(server.Selectors.getReportStats);

  let text: string;
  if (state === 'failed') {
    text = t('Reports.stats.failed');
  } else if (state === 'loading' || !stats) {
    text = t('Reports.stats.loading');
  } else {
    text = t('Reports.stats.line', {
      day: stats.reportsLast24h,
      week: stats.reportsLast7d,
      hours: stats.avgResolutionHours.toFixed(1),
    });
  }
  return <span data-testid="report-stats">{text}</span>;
}

function TopList({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={sectionLabelClass}>{title}</span>
      {rows.length === 0 ? (
        <span className="text-[12px] text-text-muted">{t('Reports.stats.none')}</span>
      ) : (
        <ol className="flex flex-col text-[12px]">
          {rows.map((row) => (
            <li key={row.key} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate text-text-primary">{row.label}</span>
              <span className="font-mono tabular-nums text-text-muted">{row.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ReportStatsDetails() {
  const { t } = useTranslation();
  const labels = useReportLabels();
  const stats = useAppSelector(server.Selectors.getReportStats);
  if (!stats) {
    return null;
  }
  const change = weekChange(stats.reportsThisWeek, stats.reportsLastWeek);
  return (
    <section
      aria-label={t('Reports.stats.title')}
      data-testid="report-stats-detail"
      className={cx(
        'mx-5 mb-3 grid shrink-0 gap-4 rounded-ui-lg border border-border-subtle bg-bg-surface p-3',
        'text-[12px] text-text-secondary md:grid-cols-[1.2fr_1fr_1fr_1fr]',
      )}
    >
      <div className="flex flex-col gap-1">
        <span className={sectionLabelClass}>{t('Reports.stats.title')}</span>
        <span>
          {t('Reports.stats.total', {
            total: stats.totalReports,
            open: stats.totalPending,
            assigned: stats.totalAssigned,
            resolved: stats.totalResolved,
          })}
        </span>
        <span>{t('Reports.stats.month', { month: stats.reportsLast30d })}</span>
        <span>
          {t('Reports.stats.weekCompare', {
            thisWeek: stats.reportsThisWeek,
            lastWeek: stats.reportsLastWeek,
            change: change === null ? t('Reports.stats.weekChangeNew') : `${change}%`,
          })}
        </span>
      </div>
      <TopList
        title={t('Reports.stats.topCategories')}
        rows={stats.categoryCounts.map((c) => ({ key: c.category, label: labels.category(c.category), count: c.count }))}
      />
      <TopList
        title={t('Reports.stats.mostReported')}
        rows={stats.topReportedUsers.map((u) => ({ key: u.userName, label: u.userName, count: u.count }))}
      />
      <TopList
        title={t('Reports.stats.topReporters')}
        rows={stats.topReporters.map((u) => ({ key: u.userName, label: u.userName, count: u.count }))}
      />
    </section>
  );
}
