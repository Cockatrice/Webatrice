import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUp, KeyRound, Upload } from 'lucide-react';

import { Button, PageTitle } from '@app/components';
import { AlertDialog, ConfirmDialog, PromptDialog } from '@app/dialogs';
import { Layout } from '@app/feature-wrappers/layout';
import { REPLAY_FILE_EXTENSION } from '@app/services';

import ReplayDetail from './ReplayDetail';
import ReplayList from './ReplayList';
import ReplayShareCodeDialog from './ReplayShareCodeDialog';
import { useReplayLibrary } from './useReplayLibrary';
import { useReplayPreview } from './useReplayPreview';

function Replays() {
  const { t } = useTranslation();
  const library = useReplayLibrary();
  const preview = useReplayPreview();
  const watchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { server, local } = library;
  const notice = local.notice ?? server.notice;
  const dismissNotice = local.notice ? local.dismissNotice : server.dismissNotice;

  const previewKey = library.previewSource?.key;
  const { reset } = preview;
  useEffect(() => {
    reset();
  }, [previewKey, reset]);

  const fileCount = library.items.filter((item) => item.kind === 'file').length
    + library.items
      .filter((item) => item.kind === 'match')
      .flatMap((item) => item.games)
      .filter((game) => game.localEntryId != null).length;

  return (
    <Layout className="flex flex-col">
      <PageTitle
        title={t('Replays.title')}
        subtitle={server.availability === 'available'
          ? t('Replays.subtitle', { matches: server.matches.length, files: fileCount })
          : t('Replays.subtitleLocal', { files: fileCount })}
        actions={(
          <>
            <Button icon={<KeyRound size={14} />} disabled={server.availability !== 'available'} onClick={server.openSubmitPrompt}>
              {t('Replays.action.submitCode')}
            </Button>
            <Button icon={<FileUp size={14} />} onClick={() => watchInputRef.current?.click()}>
              {t('Replays.action.openFile')}
            </Button>
            <Button icon={<Upload size={14} />} onClick={() => importInputRef.current?.click()}>
              {t('Replays.action.import')}
            </Button>
          </>
        )}
      />
      <input
        ref={watchInputRef}
        type="file"
        accept={REPLAY_FILE_EXTENSION}
        hidden
        data-testid="replay-watch-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            local.watchFile(file);
          }
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept={REPLAY_FILE_EXTENSION}
        multiple
        hidden
        data-testid="replay-import-files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) {
            local.importFiles(files);
          }
        }}
      />

      <div className="flex min-h-0 flex-1 gap-gap px-pad pb-pad">
        <ReplayList library={library} />
        <ReplayDetail library={library} preview={preview} />
      </div>

      <ConfirmDialog
        isOpen={local.deleteConfirmOpen}
        title={t('Replays.local.deleteTitle')}
        message={t('Replays.local.deleteMessage')}
        confirmLabel={t('Replays.action.delete')}
        destructive
        onConfirm={local.confirmDelete}
        onCancel={local.cancelDelete}
      />

      <ConfirmDialog
        isOpen={server.deleteConfirmOpen}
        title={t('Replays.server.deleteTitle')}
        message={t('Replays.server.deleteMessage')}
        confirmLabel={t('Replays.action.delete')}
        destructive
        onConfirm={server.confirmDelete}
        onCancel={server.cancelDelete}
      />

      <PromptDialog
        isOpen={server.submitPromptOpen}
        title={t('Replays.action.submitCode')}
        label={t('Replays.share.codeLabel')}
        validate={(value) => (value.trim() ? null : t('Replays.share.codeRequired'))}
        onSubmit={(value) => server.submitShareCode(value.trim())}
        onCancel={server.closeSubmitPrompt}
      />

      <ReplayShareCodeDialog code={server.shareCode} onClose={server.closeShareCode} />

      <AlertDialog
        isOpen={notice != null}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        severity={notice?.severity ?? 'error'}
        onDismiss={dismissNotice}
      />
    </Layout>
  );
}

export default Replays;
