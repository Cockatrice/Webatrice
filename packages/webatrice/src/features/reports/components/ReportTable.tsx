import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';
import { StaffTable, type StaffColumn } from '@app/feature-wrappers/staff';

import { useMinuteClock } from '../hooks/useMinuteClock';
import { formatReportTime, reportAge } from '../reportFormat';
import { ReportCategoryTag, ReportStatusBadge } from './ReportBadges';

export type ReportColumn = 'id' | 'age' | 'reportedUser' | 'category' | 'status' | 'assignedTo';

export const MY_REPORT_COLUMNS: ReportColumn[] = ['id', 'age', 'reportedUser', 'category', 'assignedTo', 'status'];

export const QUEUE_COLUMNS: ReportColumn[] = ['id', 'age', 'category', 'reportedUser', 'assignedTo', 'status'];

const WIDTH: Partial<Record<ReportColumn, string>> = {
  id: 'w-[64px]',
  age: 'w-[84px]',
  category: 'w-[164px]',
  assignedTo: 'w-[108px]',
  status: 'w-[108px]',
};

interface ReportTableProps {
  reports: ServerInfo_Report[];
  columns: ReportColumn[];
  selectedId: number | null;
  onSelect: (reportId: number) => void;
  onEscape?: () => void;
  label: string;
  status?: ReactNode;
  footer?: ReactNode;
}

export default function ReportTable({ reports, columns, selectedId, onSelect, onEscape, label, status, footer }: ReportTableProps) {
  const { t } = useTranslation();
  const now = useMinuteClock();

  const definitions: Record<ReportColumn, Omit<StaffColumn<ServerInfo_Report>, 'id' | 'header' | 'width'>> = {
    id: {
      render: (r) => <span className="font-mono text-[12px] text-text-muted">#{r.reportId}</span>,
      sortValue: (r) => r.reportId,
    },
    age: {
      render: (r) => {
        const age = reportAge(r.reportTime, now);
        return (
          <time className="tabular-nums text-text-secondary" dateTime={new Date(Number(r.reportTime) * 1000).toISOString()}>
            <span className="sr-only">{formatReportTime(r.reportTime)} </span>
            <span aria-hidden>{t(`Reports.age.${age.unit}`, { count: age.count })}</span>
          </time>
        );
      },
      sortValue: (r) => -Number(r.reportTime),
    },
    reportedUser: {
      render: (r) => <span className="font-medium">{r.reportedUserName}</span>,
      sortValue: (r) => r.reportedUserName.toLowerCase(),
    },
    category: { render: (r) => <ReportCategoryTag category={r.category} />, sortValue: (r) => r.category },
    status: { render: (r) => <ReportStatusBadge status={r.status} />, sortValue: (r) => r.status },
    assignedTo: {
      render: (r) => r.assignedModName
        ? <span className="text-text-secondary">{r.assignedModName}</span>
        : <span className="text-text-muted">{t('Reports.column.nobody')}</span>,
      sortValue: (r) => r.assignedModName.toLowerCase(),
    },
  };

  const staffColumns: StaffColumn<ServerInfo_Report>[] = columns.map((column) => ({
    id: column,
    header: t(`Reports.column.${column}`),
    width: WIDTH[column],
    ...definitions[column],
  }));

  return (
    <StaffTable
      label={label}
      columns={staffColumns}
      rows={reports}
      rowKey={(r) => String(r.reportId)}
      rowTestId={(r) => `report-row-${r.reportId}`}
      selectedKey={selectedId != null ? String(selectedId) : null}
      onSelect={(key) => onSelect(Number(key))}
      onEscape={onEscape}
      status={status}
      footer={footer}
    />
  );
}
