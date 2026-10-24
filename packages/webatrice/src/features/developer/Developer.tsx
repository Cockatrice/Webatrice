import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

import { Button, Checkbox } from '@app/components';
import {
  fieldClass,
  labelClass,
  sectionLabelClass,
  StaffConsole,
  StaffToolGuard,
  StaffDrawer,
  StaffHeader,
  StaffTable,
  type StaffColumn,
} from '@app/feature-wrappers/staff';
import { cx } from '@app/utils';

import { buildCommandRows, buildStatRows, type CommandRow } from './serverStatsRows';
import { MAX_REFRESH_INTERVAL_SECS, MIN_REFRESH_INTERVAL_SECS, useDeveloper } from './useDeveloper';
import LoadTimings from './LoadTimings';

const DeveloperContent = () => {
  const { t } = useTranslation();
  const developer = useDeveloper();
  const intervalId = useId();
  const [intervalText, setIntervalText] = useState(String(developer.intervalSecs));

  useEffect(() => {
    setIntervalText(String(developer.intervalSecs));
  }, [developer.intervalSecs]);

  const statRows = developer.stats ? buildStatRows(developer.stats, t) : [];
  const commandRows = developer.stats ? buildCommandRows(developer.stats.commandStats) : [];

  const columns = useMemo<StaffColumn<CommandRow>[]>(() => [
    {
      id: 'command', header: t('Developer.column.command'), sortValue: (r) => r.name.toLowerCase(),
      render: (r) => <span className="font-mono text-[12px]">{r.name}</span>,
    },
    {
      id: 'count', header: t('Developer.column.count'), width: 'w-[110px]', align: 'right',
      sortValue: (r) => Number(r.count), render: (r) => r.count,
    },
    {
      id: 'total', header: t('Developer.column.totalMs'), width: 'w-[110px]', align: 'right',
      sortValue: (r) => Number(r.totalMs), render: (r) => r.totalMs,
    },
    {
      id: 'avg', header: t('Developer.column.avgMs'), width: 'w-[100px]', align: 'right',
      sortValue: (r) => Number(r.avgMs), render: (r) => r.avgMs,
    },
  ], [t]);

  return (
    <>
      <StaffHeader
        title={t('Developer.title')}
        subtitle={<span role="status">{developer.status || t('Developer.status.idle')}</span>}
        actions={(
          <>
            <span title={t('Developer.autoRefresh.tooltip')}>
              <Checkbox checked={developer.autoRefresh} onChange={developer.setAutoRefresh} label={t('Developer.autoRefresh.label')} />
            </span>
            <span className="flex items-center gap-2" title={t('Developer.autoRefresh.intervalTooltip')}>
              <label htmlFor={intervalId} className={labelClass}>{t('Developer.autoRefresh.interval')}</label>
              <input
                id={intervalId}
                type="number"
                className={cx(fieldClass, 'w-20')}
                disabled={!developer.autoRefresh}
                value={intervalText}
                min={MIN_REFRESH_INTERVAL_SECS}
                max={MAX_REFRESH_INTERVAL_SECS}
                onChange={(event) => setIntervalText(event.target.value)}
                onBlur={() => developer.setIntervalSecs(Number(intervalText))}
              />
            </span>
            <Button variant="primary" icon={<RefreshCw size={14} aria-hidden />} onClick={developer.refresh}>
              {t('Developer.button.refresh')}
            </Button>
          </>
        )}
      />
      <LoadTimings />
      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <StaffTable
          label={t('Developer.table.commands')}
          columns={columns}
          rows={commandRows}
          rowKey={(r) => r.name}
          status={commandRows.length === 0 ? t('Developer.empty') : undefined}
        />
        <StaffDrawer
          label={t('Developer.table.stats')}
          title={<span className="font-display text-[17px] font-semibold text-text-primary">{t('Developer.table.stats')}</span>}
        >
          {statRows.length === 0 ? (
            <p className="text-[13px] text-text-muted">{t('Developer.empty')}</p>
          ) : (
            <dl className="grid grid-cols-[1fr_max-content] gap-x-4 gap-y-1.5 text-[13px]" aria-label={t('Developer.table.stats')}>
              {statRows.map((row) => (row.section ? (
                <dt key={row.label} className={cx(sectionLabelClass, 'col-span-2 mt-2')}>{row.label}</dt>
              ) : (
                <div key={row.label} className="contents">
                  <dt className="text-text-muted">{row.label}</dt>
                  <dd className="text-right tabular-nums text-text-primary">{row.value}</dd>
                </div>
              )))}
            </dl>
          )}
        </StaffDrawer>
      </div>
    </>
  );
};

const Developer = () => (
  <StaffConsole>
    <StaffToolGuard tool="developer">
      <DeveloperContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default Developer;
