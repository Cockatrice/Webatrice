import { useEffect, useId, useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardCopy, FileText, Folder, FolderOpen, Loader2, Upload, X } from 'lucide-react';

import { Button, Checkbox, Chip, IconButton, Segmented, TextInput } from '@app/components';
import { useImportSummaryText } from '@app/hooks';
import { cx } from '@app/utils';

import { DeckDialogFrame } from '../dialogs/DeckDialogFrame';
import { DECK_FILE_ACCEPT } from '../deckFiles';
import { currentDesktopOs, DESKTOP_DATA_FOLDERS, type DesktopOs } from './desktopPaths';
import { dragHasFiles, fromDataTransfer, fromInputFiles, type SourceFile } from './fileSources';
import { groupByFolder, groupByReason, type ConflictChoice } from './migrationPlan';
import { useDeckMigration, type DeckMigration, type DeckPreview } from './useDeckMigration';

export interface MigrationDialogProps {
  open: boolean;
  onClose: () => void;
  onPasteInstead: () => void;
  initialFiles?: SourceFile[];
}

const OS_LABEL_KEYS = {
  windows: 'DeckMigration.os.windows',
  macos: 'DeckMigration.os.macos',
  linux: 'DeckMigration.os.linux',
} as const;

const OS_HINT_KEYS = {
  windows: 'DeckMigration.source.hint.windows',
  macos: 'DeckMigration.source.hint.macos',
  linux: 'DeckMigration.source.hint.linux',
} as const;

const PROBLEM_KEYS = {
  unreadable: 'DeckMigration.problem.unreadable',
  empty: 'DeckMigration.problem.empty',
  tooLarge: 'DeckMigration.problem.tooLarge',
  exists: 'DeckMigration.problem.exists',
  pathTooLong: 'DeckMigration.problem.pathTooLong',
} as const;

const FAILURE_KEYS = {
  flood: 'DeckMigration.failure.flood',
  server: 'DeckMigration.failure.server',
  timeout: 'DeckMigration.failure.timeout',
  folder: 'DeckMigration.failure.folder',
} as const;

const LEG_KEYS = {
  replays: 'DeckMigration.leg.replays',
  customSets: 'DeckMigration.leg.customSets',
} as const;

const STOPPED_LEG_KEYS = {
  replays: 'DeckMigration.summary.stoppedReplays',
  customSets: 'DeckMigration.summary.stoppedCustomSets',
} as const;

const LEG_ERROR_KEYS = {
  replays: 'DeckMigration.summary.legFailed.replays',
  customSets: 'DeckMigration.summary.legFailed.customSets',
  decks: 'DeckMigration.summary.legFailed.decks',
} as const;

const ZONE_KEYS = {
  tokens: 'DeckMigration.zone.tokens',
  maybeboard: 'DeckMigration.zone.maybeboard',
} as const;

export function MigrationDialog({ open, ...props }: MigrationDialogProps) {
  if (!open) {
    return null;
  }
  return <MigrationDialogBody {...props} />;
}

function MigrationDialogBody({ onClose, onPasteInstead, initialFiles }: Omit<MigrationDialogProps, 'open'>) {
  const { t } = useTranslation();
  const titleId = useId();
  const migration = useDeckMigration();
  const { addSources } = migration;
  useEffect(() => {
    if (initialFiles?.length) {
      void addSources(initialFiles);
    }
  }, [initialFiles, addSources]);
  const busy = migration.stage === 'importing';

  return (
    <DeckDialogFrame onClose={busy ? () => {} : onClose} titleId={titleId}>
      <div
        className={[
          'relative flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden',
          'rounded-ui-lg border border-border-subtle bg-bg-surface p-6 shadow-pop',
        ].join(' ')}
      >
        {!busy && (
          <IconButton label={t('Common.action.close')} onClick={onClose} className="absolute right-3 top-3" size="sm">
            <X size={16} />
          </IconButton>
        )}
        <h2 id={titleId} className="font-display text-xl font-semibold text-text-primary">{t('DeckMigration.title')}</h2>
        {migration.error && (
          <p role="alert" className="mt-3 rounded-ui border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {migration.error}
          </p>
        )}
        {migration.stage === 'source' && <SourceStep migration={migration} onPasteInstead={onPasteInstead} />}
        {migration.stage === 'scanning' && <ScanStep migration={migration} />}
        {migration.stage === 'preview' && <PreviewStep migration={migration} />}
        {migration.stage === 'importing' && <ProgressStep migration={migration} />}
        {migration.stage === 'done' && <SummaryStep migration={migration} onClose={onClose} />}
      </div>
    </DeckDialogFrame>
  );
}

function folderInputRef(el: HTMLInputElement | null) {
  el?.setAttribute('webkitdirectory', '');
}

function SourceStep({ migration, onPasteInstead }: { migration: DeckMigration; onPasteInstead: () => void }) {
  const { t } = useTranslation();
  const [os, setOs] = useState<DesktopOs>(currentDesktopOs);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const folderPath = DESKTOP_DATA_FOLDERS[os];

  const take = (files: SourceFile[]) => {
    if (files.length) {
      void migration.addSources(files);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    take(await fromDataTransfer(event.dataTransfer));
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(folderPath);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-2 flex min-h-0 flex-col gap-4 overflow-y-auto">
      <p className="text-sm text-text-secondary">{t('DeckMigration.source.intro')}</p>
      {!migration.canStoreDecks && (
        <p className="rounded-ui border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-primary">
          {migration.isConnected ? t('DeckMigration.guest') : t('DeckMigration.offline')}
        </p>
      )}
      <div
        onDragOver={(event) => {
          if (dragHasFiles(event.dataTransfer)) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => void onDrop(event)}
        className={cx(
          'flex flex-col items-center gap-3 rounded-ui-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-bg-sunken',
        )}
      >
        <FolderOpen size={28} className="text-accent" aria-hidden />
        <p className="text-sm font-medium text-text-primary">{t('DeckMigration.source.drop')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex">
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="peer sr-only"
              aria-label={t('DeckMigration.source.pickFolder')}
              onChange={(event) => {
                take(fromInputFiles(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <span
              className={[
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-ui bg-accent px-3.5 text-[13px] font-semibold text-on-accent',
                'hover:bg-accent-hover peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                'peer-focus-visible:outline-accent',
              ].join(' ')}
            >
              <Folder size={15} aria-hidden /> {t('DeckMigration.source.pickFolder')}
            </span>
          </label>
          <label className="inline-flex">
            <input
              type="file"
              multiple
              accept={`${DECK_FILE_ACCEPT},.cor,.xml`}
              className="peer sr-only"
              aria-label={t('DeckMigration.source.pickFiles')}
              onChange={(event) => {
                take(fromInputFiles(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <span
              className={[
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-ui border border-border-control bg-bg-elevated px-3.5',
                'text-[13px] font-medium text-text-primary hover:border-accent peer-focus-visible:outline peer-focus-visible:outline-2',
                'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
              ].join(' ')}
            >
              <FileText size={15} aria-hidden /> {t('DeckMigration.source.pickFiles')}
            </span>
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-ui border border-border-subtle px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-text-primary">{t('DeckMigration.source.whereTitle')}</span>
          <Segmented<DesktopOs>
            label={t('DeckMigration.source.os')}
            value={os}
            onChange={setOs}
            items={(['windows', 'macos', 'linux'] as const).map((value) => ({ value, label: t(OS_LABEL_KEYS[value]) }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-ui-sm bg-bg-sunken px-2 py-1.5 font-mono text-[12px] text-text-primary">
            {folderPath}
          </code>
          <Button size="sm" icon={copied ? <Check size={13} /> : <ClipboardCopy size={13} />} onClick={() => void copyPath()}>
            {copied ? t('DeckMigration.source.copied') : t('DeckMigration.source.copy')}
          </Button>
        </div>
        <p className="text-xs text-text-muted">{t(OS_HINT_KEYS[os])}</p>
        <p className="text-xs text-text-muted">{t('DeckMigration.source.what')}</p>
      </div>
      <p className="text-sm text-text-secondary">
        {t('DeckMigration.source.pasteLead')}{' '}
        <button type="button" className="ui-link" onClick={onPasteInstead}>{t('DeckMigration.source.paste')}</button>
      </p>
    </div>
  );
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 overflow-hidden rounded-full bg-bg-sunken"
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  );
}

function ScanStep({ migration }: { migration: DeckMigration }) {
  const { t } = useTranslation();
  const { done, total, checkingCards } = migration.scanProgress;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <ProgressBar done={done} total={total} label={t('DeckMigration.scan.reading', { done, total })} />
      {checkingCards && (
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden /> {t('DeckMigration.scan.checkingCards')}
        </span>
      )}
    </div>
  );
}

function DeckRow({ preview, migration }: { preview: DeckPreview; migration: DeckMigration }) {
  const { t } = useTranslation();
  const checked = migration.selected.has(preview.id);
  return (
    <li className="flex flex-col px-3 py-1.5">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={checked && !preview.problem}
          disabled={Boolean(preview.problem) || !migration.canStoreDecks}
          onChange={(on) => migration.toggle([preview.id], on)}
          label={<span className="truncate">{preview.name}</span>}
          className="min-w-0 flex-1"
        />
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-xs text-text-muted">
          {preview.problem ? (
            <Chip tone="danger">{t(PROBLEM_KEYS[preview.problem])}</Chip>
          ) : (
            <>
              <span>{t('DeckMigration.preview.cards', { count: preview.cardCount })}</span>
              {preview.unknownCount > 0 && (
                <Chip tone="warning">{t('DeckMigration.preview.unknown', { count: preview.unknownCount })}</Chip>
              )}
              {preview.extraZones.map(({ zone, count }) => (
                <Chip key={zone}>
                  {zone === 'tokens' || zone === 'maybeboard' ? t(ZONE_KEYS[zone], { count }) : `${zone} ${count}`}
                </Chip>
              ))}
              {preview.onServer && <Chip tone="info">{t('DeckMigration.preview.onServer')}</Chip>}
            </>
          )}
        </span>
      </div>
      {preview.ignored.length > 0 && (
        <details className="pl-7 text-xs text-warning">
          <summary className="cursor-pointer">{t('DeckMigration.preview.ignored', { count: preview.ignored.length })}</summary>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-text-muted">
            {preview.ignored.map((line, i) => <li key={i} className="truncate">{line}</li>)}
          </ul>
        </details>
      )}
    </li>
  );
}

function PreviewStep({ migration }: { migration: DeckMigration }) {
  const { t } = useTranslation();
  const sources = migration.sources!;
  const groups = useMemo(() => groupByFolder(migration.previews), [migration.previews]);
  const options = (
    <section aria-label={t('DeckMigration.preview.options')} className="flex flex-col gap-3">
      {migration.previews.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            icon={<Folder size={14} aria-hidden />}
            label={t('DeckMigration.preview.destination')}
            value={migration.destination}
            maxLength={80}
            disabled={!migration.canStoreDecks}
            placeholder={t('DeckMigration.preview.destinationTop')}
            onChange={(event) => migration.setDestination(event.target.value)}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-text-secondary">{t('DeckMigration.preview.sameName')}</span>
            <Segmented<ConflictChoice>
              label={t('DeckMigration.preview.sameName')}
              value={migration.choice}
              onChange={migration.setChoice}
              items={[
                { value: 'skip', label: t('DeckMigration.preview.skip') },
                { value: 'keepBoth', label: t('DeckMigration.preview.keepBoth') },
              ]}
            />
          </div>
        </div>
      )}
      {sources.replays.length > 0 && (
        <Checkbox
          checked={migration.includeReplays}
          onChange={migration.setIncludeReplays}
          label={t('DeckMigration.preview.replays', { count: sources.replays.length })}
        />
      )}
      {sources.customSets.length > 0 && (
        <Checkbox
          checked={migration.includeCustomSets}
          onChange={migration.setIncludeCustomSets}
          label={t('DeckMigration.preview.customSets', { count: sources.customSets.length })}
        />
      )}
      {sources.cardDatabase.length > 0 && (
        <p className="text-xs text-text-muted">{t('DeckMigration.preview.cardDatabase', { files: sources.cardDatabase.join(', ') })}</p>
      )}
    </section>
  );
  const readable = migration.previews.filter((p) => !p.problem);
  const uploadCount = migration.canStoreDecks ? migration.plan.uploads.length : 0;
  const nothing = uploadCount === 0
    && !(migration.includeReplays && sources.replays.length)
    && !(migration.includeCustomSets && sources.customSets.length);

  return (
    <>
      <p className="mt-2 text-sm text-text-secondary">
        {t('DeckMigration.preview.found', {
          decks: migration.previews.length, folders: groups.length, replays: sources.replays.length, sets: sources.customSets.length,
        })}
      </p>
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {options}
        {migration.previews.length > 0 && (
          <section aria-label={t('DeckMigration.preview.decks')} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{t('DeckMigration.preview.decks')}</h3>
              <span className="flex gap-2">
                <Button size="sm" disabled={!migration.canStoreDecks} onClick={() => migration.toggle(readable.map((p) => p.id), true)}>
                  {t('DeckMigration.preview.all')}
                </Button>
                <Button size="sm" disabled={!migration.canStoreDecks} onClick={() => migration.toggle(readable.map((p) => p.id), false)}>
                  {t('DeckMigration.preview.none')}
                </Button>
              </span>
            </div>
            {!migration.canStoreDecks && (
              <p className="text-xs text-text-muted">{migration.isConnected ? t('DeckMigration.guest') : t('DeckMigration.offline')}</p>
            )}
            <div className="rounded-ui border border-border-subtle">
              {groups.map(({ folder, decks }) => (
                <div key={folder} className="border-b border-border-subtle last:border-b-0">
                  <div className="flex items-center gap-2 bg-bg-sunken px-3 py-1.5 text-xs font-semibold text-text-secondary">
                    <Folder size={13} aria-hidden /> {folder || t('DeckMigration.preview.topFolder')}
                  </div>
                  <ul>
                    {decks.map((preview) => <DeckRow key={preview.id} preview={preview} migration={migration} />)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="mt-4 flex shrink-0 items-center justify-end gap-2">
        <Button onClick={migration.reset}>{t('Common.action.back')}</Button>
        <Button variant="primary" icon={<Upload size={14} />} disabled={nothing} onClick={() => void migration.start()}>
          {t('DeckMigration.preview.import', { count: uploadCount })}
        </Button>
      </div>
    </>
  );
}

function ProgressStep({ migration }: { migration: DeckMigration }) {
  const { t } = useTranslation();
  const { done, total, current, creatingFolder } = migration.progress;
  const leg = migration.leg;
  return (
    <div className="mt-6 flex flex-col gap-4">
      {leg && leg !== 'decks' && <p className="text-sm text-text-secondary">{t(LEG_KEYS[leg])}</p>}
      <ProgressBar done={done} total={total} label={t('DeckMigration.progress.decks', { done, total })} />
      {current && (
        <span className="truncate text-xs text-text-muted">
          {creatingFolder ? t('DeckMigration.progress.folders', { name: current }) : current}
        </span>
      )}
      <p className="text-sm text-text-secondary">{t('DeckMigration.progress.keepOpen')}</p>
      <div className="flex justify-end">
        <Button onClick={migration.cancel} disabled={migration.stopping}>
          {t(migration.stopping ? 'DeckMigration.progress.stopping' : 'DeckMigration.progress.stop')}
        </Button>
      </div>
    </div>
  );
}

function SummaryStep({ migration, onClose }: { migration: DeckMigration; onClose: () => void }) {
  const { t } = useTranslation();
  const summaryText = useImportSummaryText();
  const result = migration.result!;
  const decks = result.decks;
  const unknown = decks?.imported.filter((d) => d.unknownCount > 0) ?? [];
  const replays = result.replays ? summaryText(result.replays, 'replays') : null;
  const sets = result.customSets ? summaryText(result.customSets, 'cardFiles') : null;

  return (
    <>
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" aria-live="polite">
        {decks && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('DeckMigration.summary.decks', { count: decks.imported.length })}
            </h3>
            {groupByReason(decks.skipped).map(({ reason, names }) => (
              <details key={reason} className="text-xs text-text-muted">
                <summary className="cursor-pointer">
                  {t('DeckMigration.summary.skippedGroup', { count: names.length, reason: t(PROBLEM_KEYS[reason]) })}
                </summary>
                <p className="mt-1 pl-4">{names.join(', ')}</p>
              </details>
            ))}
            {decks.failed.length > 0 && (
              <ul className="text-xs text-danger">
                {decks.failed.map((f, i) => (
                  <li key={i}>{f.name}: {t(FAILURE_KEYS[f.reason], { code: f.code ?? '', folder: f.folder ?? '' })}</li>
                ))}
              </ul>
            )}
            {decks.stopped && (
              <p className="text-xs text-warning">
                {t(decks.stopped === 'disconnected' ? 'DeckMigration.summary.disconnected' : 'DeckMigration.summary.cancelled',
                  { count: decks.notStarted })}
              </p>
            )}
            {unknown.length > 0 && (
              <p className="text-xs text-text-muted">
                {t('DeckMigration.summary.unknown', { names: unknown.map((d) => d.name).join(', ') })}
              </p>
            )}
            {decks.imported.some((d) => d.renamedFrom) && (
              <p className="text-xs text-text-muted">{t('DeckMigration.summary.renamed')}</p>
            )}
          </section>
        )}
        {replays && (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">{replays.headline}</h3>
            {replays.problems.map((line) => <p key={line} className="text-xs text-text-muted">{line}</p>)}
          </section>
        )}
        {sets && (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">{sets.headline}</h3>
            {sets.problems.map((line) => <p key={line} className="text-xs text-text-muted">{line}</p>)}
          </section>
        )}
        {result.stoppedLegs.map((leg) => leg !== 'decks' && (
          <p key={leg} className="text-xs text-warning">{t(STOPPED_LEG_KEYS[leg])}</p>
        ))}
        {result.legErrors.map(({ leg, detail }) => (
          <p key={leg} role="alert" className="text-xs text-danger">{t(LEG_ERROR_KEYS[leg], { detail })}</p>
        ))}
        {decks?.failed.length || decks?.stopped || result.stoppedLegs.length || result.legErrors.length ? (
          <p className="text-xs text-text-muted">{t('DeckMigration.summary.again')}</p>
        ) : null}
      </div>
      <div className="mt-4 flex shrink-0 items-center justify-end gap-2">
        <Button onClick={migration.reset}>{t('DeckMigration.summary.more')}</Button>
        <Button variant="primary" onClick={onClose}>{t('DeckMigration.summary.done')}</Button>
      </div>
    </>
  );
}
