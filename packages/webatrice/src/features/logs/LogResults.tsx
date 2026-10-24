import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ServerInfo_ChatMessage } from '@cockatrice/sockatrice/generated';
import type { ServerStateLogs } from '@cockatrice/datatrice';
import {
  sectionLabelClass, StaffDrawer, StaffTable, staffTabIds, StaffTabs, type StaffColumn,
} from '@app/feature-wrappers/staff';

import { cx } from '@app/utils';

import { useLogResults } from './useLogResults';

interface LogResultsProps {
  logs: ServerStateLogs;
}

const LOG_TABS = ['room', 'game', 'chat'] as const;
type LogTab = typeof LOG_TABS[number];

const TAB_LABEL_KEYS = {
  room: 'Logs.tab.rooms',
  game: 'Logs.tab.games',
  chat: 'Logs.tab.chats',
} as const;

interface LogRow {
  key: string;
  log: ServerInfo_ChatMessage;
}

const toRows = (logs: ServerInfo_ChatMessage[] | undefined): LogRow[] =>
  (logs ?? []).map((log, index) => ({ key: `${log.time}-${log.senderIp}-${index}`, log }));

const mono = 'font-mono text-[12px]';

const LogResults = ({ logs }: LogResultsProps) => {
  const { t } = useTranslation();
  const { value, handleChange, selectedKey, select } = useLogResults();
  const tabsId = useId();
  const tab = LOG_TABS[value];
  const rows = useMemo(() => toRows(logs[tab]), [logs, tab]);
  const selected = rows.find((row) => row.key === selectedKey)?.log;

  const columns = useMemo<StaffColumn<LogRow>[]>(() => [
    { id: 'time', header: t('Logs.column.time'), width: 'w-[150px]', render: (r) => <span className={mono}>{r.log.time}</span>,
      sortValue: (r) => r.log.time },
    {
      id: 'sender', header: t('Logs.column.senderName'), width: 'w-[140px]', sortValue: (r) => r.log.senderName.toLowerCase(),
      render: (r) => <span className="font-medium">{r.log.senderName}</span>,
    },
    { id: 'ip', header: t('Logs.column.senderIp'), width: 'w-[120px]', render: (r) => <span className={mono}>{r.log.senderIp}</span> },
    { id: 'message', header: t('Logs.column.message'), render: (r) => r.log.message },
    { id: 'target', header: t('Logs.column.targetName'), width: 'w-[150px]', render: (r) => r.log.targetName,
      sortValue: (r) => r.log.targetName.toLowerCase() },
  ], [t]);

  const tabLabel = (key: LogTab) => {
    const count = logs[key]?.length ?? 0;
    const name = t(TAB_LABEL_KEYS[key]);
    return count > 0 ? t('Logs.tabWithCount', { tab: name, count }) : name;
  };

  const details: [string, string][] = selected ? [
    [t('Logs.column.time'), selected.time],
    [t('Logs.column.senderName'), selected.senderName],
    [t('Logs.column.senderIp'), selected.senderIp],
    [t('Logs.column.targetName'), selected.targetName],
    [t('Logs.column.targetId'), selected.targetId],
  ] : [];

  return (
    <>
      <StaffTabs
        tabsId={tabsId}
        label={t('Logs.title')}
        value={tab}
        onChange={(next) => handleChange(null, LOG_TABS.indexOf(next))}
        items={LOG_TABS.map((key) => ({ value: key, label: tabLabel(key) }))}
      />
      <div
        className="flex min-h-0 flex-1"
        role="tabpanel"
        id={staffTabIds(tabsId, tab).panel}
        aria-labelledby={staffTabIds(tabsId, tab).tab}
      >
        <StaffTable
          label={t(TAB_LABEL_KEYS[tab])}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          selectedKey={selectedKey}
          onSelect={select}
          onEscape={() => select(null)}
          status={rows.length === 0 ? t('Logs.empty') : undefined}
        />
        {selected && (
          <StaffDrawer
            label={t('Logs.details')}
            onClose={() => select(null)}
            title={<span className="font-display text-[17px] font-semibold text-text-primary">{selected.senderName}</span>}
            subtitle={selected.time}
          >
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {details.map(([label, text]) => (
                <div key={label} className="contents">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="break-words text-text-primary">{text}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-1">
              <span className={sectionLabelClass}>{t('Logs.column.message')}</span>
              <p className={cx(
                'whitespace-pre-wrap break-words rounded-ui border border-border-subtle bg-bg-sunken px-3 py-2',
                'text-[13px] text-text-primary',
              )}
              >
                {selected.message}
              </p>
            </div>
          </StaffDrawer>
        )}
      </div>
    </>
  );
};

export default LogResults;
