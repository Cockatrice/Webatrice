import { useTranslation } from 'react-i18next';
import { Download, HardDriveDownload, Link2, Lock, LockOpen, Trash2 } from 'lucide-react';

import { Button, IconButton } from '@app/components';
import { ReplayPreview } from '@app/feature-widgets/replay-player';
import { formatReplayTime } from '@app/utils';
import { REPLAY_LIBRARY_ROOT } from '@app/services';
import { cx, toBcp47 } from '@app/utils';

import { PlayerName, formatItemDate } from './ReplayList';
import { isFullySaved, savedGameCount, type FileItem, type MatchItem } from './replayLibrary';
import type { ReplayLibrary } from './useReplayLibrary';
import type { ReplayPreviewState } from './useReplayPreview';
import { useReplayShortcuts } from './useReplayShortcuts';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function Players({ players, countries }: { players: string[]; countries: Record<string, string> }) {
  const { t } = useTranslation();
  if (players.length === 2) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-text-primary">
        <PlayerName name={players[0]} country={countries[players[0]]} avatar />
        <span className="shrink-0 text-[11px] text-text-muted">{t('Replays.detail.versus')}</span>
        <PlayerName name={players[1]} country={countries[players[1]]} avatar />
      </span>
    );
  }
  return (
    <span className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-[13px] text-text-primary">
      {players.map((player) => <PlayerName key={player} name={player} country={countries[player]} avatar />)}
    </span>
  );
}

function MatchActions({ item, library }: { item: MatchItem; library: ReplayLibrary }) {
  const { t } = useTranslation();
  const { server } = library;
  const enabled = server.availability === 'available';
  const complete = isFullySaved(item);
  const missing = item.games.filter((game) => game.localEntryId == null).map((game) => game.replayId);
  const saveLabel = complete
    ? t('Replays.detail.inLibrary')
    : savedGameCount(item) > 0
      ? t('Replays.detail.saveMissing', { count: missing.length })
      : t('Replays.detail.saveToLibrary');
  const localEntryId = library.selectedGame?.localEntryId;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="quiet"
        aria-pressed={item.keep}
        disabled={!enabled}
        icon={item.keep ? <Lock size={13} /> : <LockOpen size={13} />}
        onClick={server.toggleKeep}
      >
        {item.keep ? t('Replays.detail.kept') : t('Replays.detail.keep')}
      </Button>
      <Button size="sm" variant="quiet" disabled={!enabled} icon={<Link2 size={13} />} onClick={server.getShareCode}>
        {t('Replays.detail.shareCode')}
      </Button>
      <Button size="sm" variant="quiet" disabled={!enabled} icon={<Download size={13} />} onClick={server.download}>
        {t('Replays.detail.download')}
      </Button>
      <Button
        size="sm"
        variant="quiet"
        disabled={!enabled || complete}
        icon={<HardDriveDownload size={13} />}
        onClick={() => server.saveToLibrary(REPLAY_LIBRARY_ROOT, missing)}
      >
        {saveLabel}
      </Button>
      {localEntryId != null && (
        <>
          <Button size="sm" variant="quiet" icon={<Download size={13} />} onClick={() => library.local.exportEntry(localEntryId)}>
            {t('Replays.detail.saveAsFile')}
          </Button>
          <IconButton
            size="sm"
            label={t('Replays.detail.deleteFile')}
            className="hover:!text-danger"
            onClick={() => library.local.requestDelete(localEntryId)}
          >
            <Trash2 size={14} />
          </IconButton>
        </>
      )}
      <IconButton
        size="sm"
        label={t('Replays.detail.deleteFromServer')}
        disabled={!enabled}
        className="hover:!text-danger"
        onClick={server.requestDelete}
      >
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
}

function FileActions({ item, library }: { item: FileItem; library: ReplayLibrary }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="quiet" icon={<Download size={13} />} onClick={() => library.local.exportEntry(item.entryId)}>
        {t('Replays.detail.saveAsFile')}
      </Button>
      <IconButton
        size="sm"
        label={t('Replays.detail.deleteFile')}
        className="hover:!text-danger"
        onClick={() => library.local.requestDelete(item.entryId)}
      >
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
}

function PreviewPlaceholder({ library, preview }: { library: ReplayLibrary; preview: ReplayPreviewState }) {
  const { t } = useTranslation();
  const { selected, selectedGame, previewSource } = library;
  if (!selected || !previewSource) {
    return null;
  }
  const local = selected.kind === 'file' || selectedGame?.localEntryId != null;
  const name = selected.kind === 'file' ? selected.name : selectedGame?.name ?? selected.name;
  return (
    <div
      className={[
        'flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-ui border border-dashed',
        'border-border-strong bg-bg-sunken p-4 text-center',
      ].join(' ')}
      data-testid="replay-preview-placeholder"
    >
      <span className="text-[14px] font-medium text-text-primary">{t('Replays.preview.title', { name })}</span>
      <span className="max-w-[420px] text-[12px] text-text-muted">
        {local ? t('Replays.preview.localHint') : t('Replays.preview.serverHint')}
      </span>
      {preview.status === 'error' && (
        <span className="max-w-[420px] text-[12px] text-danger" role="alert">
          {t('Replays.preview.failed', { error: preview.error ?? '' })}
        </span>
      )}
      <Button
        variant="primary"
        icon={<HardDriveDownload size={14} />}
        disabled={preview.status === 'loading'}
        onClick={() => preview.load(previewSource)}
      >
        {preview.status === 'loading'
          ? t('Replays.preview.loading')
          : preview.status === 'error'
            ? t('Replays.preview.retry')
            : local ? t('Replays.preview.readAndPreview') : t('Replays.preview.downloadAndPreview')}
      </Button>
    </div>
  );
}

export interface ReplayDetailProps {
  library: ReplayLibrary;
  preview: ReplayPreviewState;
}

function ReplayDetail({ library, preview }: ReplayDetailProps) {
  const { t, i18n } = useTranslation();
  const locale = toBcp47(i18n.language) || undefined;
  const { selected, selectedGame } = library;

  if (!selected) {
    return (
      <section
        className={[
          'flex min-w-0 flex-1 items-center justify-center rounded-ui-lg border border-border-subtle',
          'bg-bg-surface p-4 text-center text-[13px] text-text-muted',
        ].join(' ')}
        aria-label={t('Replays.detail.label')}
      >
        {t('Replays.detail.empty')}
      </section>
    );
  }

  const ready = preview.status === 'ready' && preview.opened && preview.key === library.previewSource?.key;
  const meta = selected.kind === 'match'
    ? [
      selected.startedAt ? formatItemDate(selected.startedAt, library.now, locale) : null,
      selected.room || null,
      t('Replays.detail.gameNumber', { id: selected.gameId }),
      t('Replays.detail.total', { duration: formatReplayTime(selected.durationSec * 1000) }),
    ]
    : [
      t('Replays.detail.imported', { date: formatItemDate(selected.modifiedAt, library.now, locale) }),
      t('Replays.list.fileSize', { size: Math.max(1, Math.round(selected.sizeBytes / 1024)) }),
      selected.folder ? t('Replays.list.savedIn', { folder: selected.folder }) : t('Replays.list.onlyHere'),
    ];

  return (
    <section
      className="flex min-w-0 flex-1 flex-col gap-3 rounded-ui-lg border border-border-subtle bg-bg-surface p-4"
      aria-label={t('Replays.detail.label')}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate font-display text-[19px] font-semibold text-text-primary">{selected.name}</h2>
          <span className="flex flex-wrap items-center gap-x-2 text-[12px] tabular-nums text-text-muted">
            {meta.filter((part): part is string => part != null).map((part, index) => (
              <span key={part} className="inline-flex items-center gap-x-2">
                {index > 0 && <span aria-hidden>·</span>}
                <span>{part}</span>
              </span>
            ))}
          </span>
        </div>
        {selected.kind === 'match' ? <MatchActions item={selected} library={library} /> : <FileActions item={selected} library={library} />}
      </div>

      {selected.kind === 'match' && (
        <div className="flex flex-wrap items-center gap-3">
          <Players players={selected.players} countries={library.countries} />
          <span
            className="ml-auto inline-flex rounded-ui border border-border-subtle bg-bg-sunken p-0.5"
            role="tablist"
            aria-label={t('Replays.detail.games')}
          >
            {selected.games.map((game, index) => (
              <button
                key={game.replayId}
                type="button"
                role="tab"
                aria-selected={index === library.gameIndex}
                onClick={() => library.setGameIndex(index)}
                className={cx(
                  'inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] font-medium',
                  index === library.gameIndex ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
                  focusRing,
                )}
              >
                {game.name}
                <span className="font-mono text-[10px] tabular-nums text-text-muted">{formatReplayTime(game.durationSec * 1000)}</span>
              </button>
            ))}
          </span>
        </div>
      )}

      {ready ? (
        <>
          <span className="-mb-1 flex items-center gap-2 text-[12px] text-text-muted">
            <HardDriveDownload size={13} />
            {selected.kind === 'file' || selectedGame?.localEntryId != null
              ? t('Replays.preview.loadedLocal', { name: selected.kind === 'file' ? selected.name : selectedGame?.name ?? '' })
              : t('Replays.preview.loadedServer', { id: selectedGame?.replayId ?? '' })}
          </span>
          <ReplayPreview opened={preview.opened!} onWatchFrom={preview.watchFrom} useShortcuts={useReplayShortcuts} />
        </>
      ) : (
        <PreviewPlaceholder library={library} preview={preview} />
      )}
    </section>
  );
}

export default ReplayDetail;
