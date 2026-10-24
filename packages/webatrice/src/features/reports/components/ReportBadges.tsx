import { useTranslation } from 'react-i18next';

import { Chip } from '@app/components';
import { cx } from '@app/utils';

import { reportCategorySeverity, reportStatusTone } from '../reportFormat';

const SEVERITY_DOT = {
  severe: 'bg-danger',
  play: 'bg-warning',
  other: 'bg-text-muted',
} as const;

export function useReportLabels() {
  const { t, i18n } = useTranslation();
  const status = (code: string) => (i18n.exists(`Reports.status.${code}`) ? t(`Reports.status.${code}`) : code);
  const category = (code: string) =>
    (i18n.exists(`ReportUserDialog.categoryLabel.${code}`) ? t(`ReportUserDialog.categoryLabel.${code}`) : code);
  return { status, category };
}

export function ReportStatusBadge({ status }: { status: string }) {
  const labels = useReportLabels();
  return (
    <Chip tone={reportStatusTone(status)} icon={<span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}>
      {labels.status(status)}
    </Chip>
  );
}

export function ReportCategoryTag({ category, className }: { category: string; className?: string }) {
  const labels = useReportLabels();
  return (
    <span className={cx('inline-flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-text-primary', className)}>
      <span className={cx('h-2 w-2 shrink-0 rounded-[2px]', SEVERITY_DOT[reportCategorySeverity(category)])} aria-hidden />
      <span className="truncate">{labels.category(category)}</span>
    </span>
  );
}
