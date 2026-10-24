import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Lock, LockOpen } from 'lucide-react';

import { Avatar, SectionLabel, Segmented, TextInput } from '@app/components';
import { formatReplayTime } from '@app/utils';
import { Images } from '@app/images';
import { cx, toBcp47 } from '@app/utils';

import { dayGroupOf, isSavedLocally, type ReplayItem, type ReplaySource } from './replayLibrary';
import type { ReplayLibrary } from './useReplayLibrary';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const GROUP_KEYS = {
  today: 'Replays.group.today',
  yesterday: 'Replays.group.yesterday',
  week: 'Replays.group.week',
  older: 'Replays.group.older',
} as const;

export function PlayerName({ name, country, avatar, className }: { name: string; country?: string; avatar?: boolean; className?: string }) {
  const flag = country ? Images.Countries[country.toLowerCase() as keyof typeof Images.Countries] : undefined;
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-1.5', className)}>
      {avatar && <Avatar name={name} size={20} />}
      {flag && <img src={flag} alt="" className="h-3 w-4 shrink-0 rounded-[2px]" />}
      <span className="truncate">{name}</span>
    </span>
  );
}

function dateFormatters(locale: string | undefined) {
  return {
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    dateTime: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
  };
}

export function formatItemDate(time: number, now: number, locale: string | undefined, formatters = dateFormatters(locale)): string {
  const group = dayGroupOf(time, now);
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return date.toString();
  }
  if (group === 'today' || group === 'yesterday') {
    return formatters.time.format(date);
  }
  return formatters.dateTime.format(date);
}

function ListRow({ item, selected, countries, now, locale, formatters, onSelect }: {
  item: ReplayItem;
  selected: boolean;
  countries: Record<string, string>;
  now: number;
  locale: string | undefined;
  formatters: ReturnType<typeof dateFormatters>;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const date = formatItemDate(item.kind === 'match' ? item.startedAt ?? 0 : item.modifiedAt, now, locale, formatters);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      data-testid={`replay-item-${item.id}`}
      className={cx(
        'flex w-full flex-col gap-1 rounded-ui border px-pad py-[calc(var(--pad)*0.6)] text-left',
        selected ? 'border-accent/60 bg-accent/10' : 'border-transparent hover:bg-bg-elevated',
        focusRing,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{item.name}</span>
        {item.kind === 'match' && (
          <span className="font-mono text-[12px] tabular-nums text-text-secondary">{formatReplayTime(item.durationSec * 1000)}</span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-[12px] text-text-secondary">
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {item.kind === 'match'
            ? item.players.map((player) => <PlayerName key={player} name={player} country={countries[player]} className="shrink-0" />)
            : <span className="inline-flex items-center gap-1 text-text-muted"><HardDrive size={12} /> {t('Replays.list.onlyHere')}</span>}
        </span>
        <span className="shrink-0 text-text-muted">{date}</span>
      </span>
      <span className="flex items-center gap-2 text-[11px] text-text-muted">
        {item.kind === 'match' ? (
          <>
            <span>{item.games.length === 1 ? t('Replays.list.oneGame') : t('Replays.list.games', { count: item.games.length })}</span>
            <span className="inline-flex items-center gap-1">
              {item.keep ? <Lock size={11} className="text-success" /> : <LockOpen size={11} />}
              {item.keep ? t('Replays.list.kept') : t('Replays.list.notKept')}
            </span>
            {isSavedLocally(item) && (
              <span className="truncate">
                {item.localFolder ? t('Replays.list.savedIn', { folder: item.localFolder }) : t('Replays.list.savedHere')}
              </span>
            )}
          </>
        ) : (
          <>
            <span>{t('Replays.list.fileSize', { size: Math.max(1, Math.round(item.sizeBytes / 1024)) })}</span>
            {item.folder && <span className="truncate">{t('Replays.list.savedIn', { folder: item.folder })}</span>}
          </>
        )}
      </span>
    </button>
  );
}

export interface ReplayListProps {
  library: ReplayLibrary;
}

function ReplayList({ library }: ReplayListProps) {
  const { t, i18n } = useTranslation();
  const locale = toBcp47(i18n.language) || undefined;
  const formatters = useMemo(() => dateFormatters(locale), [locale]);
  const { server, local } = library;
  const serverNote = server.availability === 'disconnected'
    ? t('Replays.server.disconnected')
    : server.availability === 'unregistered' ? t('Replays.server.unregistered') : null;
  const loading = (server.availability === 'available' && server.loading && server.matches.length === 0) || local.loading;
  const sourceItems: { value: ReplaySource; label: string }[] = [
    { value: 'all', label: t('Replays.source.all') },
    { value: 'server', label: t('Replays.source.server') },
    { value: 'local', label: t('Replays.source.local') },
  ];

  return (
    <aside
      className="flex w-[400px] shrink-0 flex-col rounded-ui-lg border border-border-subtle bg-bg-surface"
      aria-label={t('Replays.list.label')}
    >
      <div className="flex flex-col gap-2 border-b border-border-subtle p-3">
        <TextInput
          aria-label={t('Replays.list.search')}
          placeholder={t('Replays.list.searchPlaceholder')}
          value={library.query}
          onChange={(event) => library.setQuery(event.target.value)}
        />
        <Segmented
          label={t('Replays.source.label')}
          value={library.source}
          onChange={library.setSource}
          items={sourceItems.map((item) => ({
            value: item.value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                <span className="font-mono text-[10px] tabular-nums text-text-muted">{library.counts[item.value]}</span>
              </span>
            ),
          }))}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-6" data-testid="replay-list">
        {serverNote && library.source !== 'local' && (
          <p className="px-3 py-2 text-[12px] text-text-muted">{serverNote}</p>
        )}
        {loading && library.visible.length === 0 && (
          <p className="px-3 py-2 text-[12px] text-text-muted">{t('Replays.list.loading')}</p>
        )}
        {!loading && library.visible.length === 0 && (
          <p className="px-3 py-2 text-[12px] text-text-muted">
            {library.query ? t('Replays.list.noMatches') : t('Replays.list.empty')}
          </p>
        )}
        {library.groups.map((group) => (
          <div key={group.group} className="mb-2 flex flex-col gap-0.5">
            <SectionLabel className="px-3 pb-1 pt-2">{t(GROUP_KEYS[group.group])}</SectionLabel>
            {group.items.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                selected={library.selected?.id === item.id}
                countries={library.countries}
                now={library.now}
                locale={locale}
                formatters={formatters}
                onSelect={() => library.select(item.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default ReplayList;
