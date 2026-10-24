import { useTranslation } from 'react-i18next';
import { Link, generatePath } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { focusRing, sectionLabelClass, UserSanctionButtons } from '@app/feature-wrappers/staff';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
import { cx } from '@app/utils';

import { accountAgeDays, formatReportDate } from '../reportFormat';
import { useReportLabels } from './ReportBadges';

interface ReportUserContextPanelProps {
  userName: string;
  failed: boolean;
  now: number;
}

const NEW_ACCOUNT_DAYS = 30;

function Count({ value, label, tone }: { value: number | undefined; label: string; tone: 'warning' | 'danger' }) {
  const active = (value ?? 0) > 0;
  return (
    <span>
      <b className={cx('tabular-nums', active ? (tone === 'danger' ? 'text-danger' : 'text-warning') : 'text-text-primary')}>
        {value ?? '-'}
      </b>{' '}
      {label}
    </span>
  );
}

export default function ReportUserContextPanel({ userName, failed, now }: ReportUserContextPanelProps) {
  const { t } = useTranslation();
  const labels = useReportLabels();
  const info = useAppSelector((state) => server.Selectors.getUserInvestigation(state, userName)?.info);
  const days = info ? accountAgeDays(info.registrationTime, now) : null;

  let age: string;
  if (failed) {
    age = t('Reports.userContext.loadFailed');
  } else if (!info || days === null) {
    age = t('Reports.loading');
  } else {
    age = t('Reports.userContext.ageValue', { days, date: formatReportDate(info.registrationTime) });
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-ui border border-border-subtle p-3"
      aria-label={t('Reports.userContext.title')}
      data-testid="report-user-context"
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold text-text-primary">{userName}</span>
        <span className="text-[12px] text-text-muted">{age}</span>
        <Link
          className={cx('ml-auto rounded-ui-sm text-[12px] font-medium text-accent hover:underline', focusRing)}
          to={generatePath(RouteEnum.PLAYER, { name: userName })}
        >
          {t('Reports.userContext.openProfile')}
        </Link>
      </div>
      {days !== null && days < NEW_ACCOUNT_DAYS && (
        <span
          className={cx(
            'inline-flex items-center gap-1.5 self-start rounded-full bg-warning/15 px-2 py-0.5',
            'text-[11px] font-medium text-warning',
          )}
        >
          <ShieldAlert size={12} aria-hidden /> {t('Reports.userContext.newAccount')}
        </span>
      )}
      <span className="flex flex-wrap gap-4 text-[12px] text-text-secondary">
        <Count value={info?.totalReports} label={t('Reports.userContext.reports')} tone="warning" />
        <Count value={info?.totalWarns} label={t('Reports.userContext.warns')} tone="warning" />
        <Count value={info?.totalBans} label={t('Reports.userContext.bans')} tone="danger" />
      </span>
      {info && (
        <>
          <div className="flex flex-col gap-1">
            <span className={sectionLabelClass}>{t('Reports.userContext.adminNotes')}</span>
            <p
              className={cx(
                'whitespace-pre-wrap break-words rounded-ui-sm bg-bg-base/60 px-2 py-1.5',
                'text-[12px] leading-snug text-text-secondary',
              )}
            >
              {info.adminNotes || t('Reports.userContext.none')}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className={sectionLabelClass}>{t('Reports.userContext.recentReports')}</span>
            {info.recentReports.length === 0 ? (
              <span className="text-[12px] text-text-muted">{t('Reports.userContext.noRecent')}</span>
            ) : (
              <ul className="max-h-28 overflow-y-auto font-mono text-[11.5px] text-text-secondary">
                {info.recentReports.map((r) => (
                  <li key={r.reportId}>
                    {t('Reports.userContext.recentLine', {
                      date: formatReportDate(r.reportTime),
                      id: String(r.reportId),
                      reporter: r.reporterName,
                      status: labels.status(r.status),
                      category: labels.category(r.category),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <UserSanctionButtons userName={userName} />
    </section>
  );
}
