import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import { VirtualRows } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { useAppSelector } from '@app/store';

import { buildInviteRows, type InviteRow } from './inviteCandidates';

const ROW_HEIGHT = 30;

export interface InviteToGameDialogProps {
  isOpen: boolean;
  onlyBuddies: boolean;
  excludeNames: ReadonlySet<string>;
  onInvite: (userName: string) => void;
  onClose: () => void;
}

export default function InviteToGameDialog({ isOpen, onlyBuddies, excludeNames, onInvite, onClose }: InviteToGameDialogProps) {
  const { t } = useTranslation();
  const users = useAppSelector(server.Selectors.getUsers);
  const buddyList = useAppSelector(server.Selectors.getBuddyList);
  const ignoreList = useAppSelector(server.Selectors.getIgnoreList);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(
    () => buildInviteRows({ users, buddyList, ignoreList, excludeNames, onlyBuddies, search }),
    [users, buddyList, ignoreList, excludeNames, onlyBuddies, search],
  );
  const selectedName = selected && rows.some((row) => row.kind === 'user' && row.name === selected) ? selected : null;

  const close = useCallback(() => {
    setSearch('');
    setSelected(null);
    onClose();
  }, [onClose]);

  const invite = useCallback(
    (name: string) => {
      onInvite(name);
      close();
    },
    [onInvite, close],
  );

  const renderRow = useCallback(
    (row: InviteRow) => {
      if (row.kind === 'header') {
        return (
          <div className="h-full flex items-end px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {row.section === 'buddies' ? t('GameInvite.dialog.buddies') : t('GameInvite.dialog.online')}
          </div>
        );
      }
      const isSelected = row.name === selectedName;
      return (
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => setSelected(row.name)}
          onDoubleClick={() => invite(row.name)}
          className={[
            'w-full h-full px-3 text-left text-sm truncate board-motion transition-colors',
            isSelected ? 'bg-accent/25 text-text-primary' : 'text-text-primary hover:bg-bg-elevated',
          ].join(' ')}
        >
          {row.name}
        </button>
      );
    },
    [selectedName, invite, t],
  );

  return (
    <DialogShell isOpen={isOpen} handleClose={close} title={t('GameInvite.dialog.title')} maxWidth="max-w-sm">
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('GameInvite.dialog.search')}
          aria-label={t('GameInvite.dialog.search')}
          className={[
            'w-full px-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm text-text-primary',
            'placeholder:text-text-muted focus:outline-none focus:border-accent',
          ].join(' ')}
        />
        <div className="h-72 rounded-md border border-border-subtle bg-bg-base/40" data-testid="invite-user-list">
          {rows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs italic text-text-muted">
              {t('GameInvite.dialog.empty')}
            </div>
          ) : (
            <VirtualRows items={rows} rowHeight={ROW_HEIGHT} renderRow={renderRow} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!selectedName}
            onClick={() => selectedName && invite(selectedName)}
            className={[
              'px-4 py-1.5 rounded-md text-sm font-semibold bg-accent text-on-accent hover:bg-accent-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed board-motion transition-colors',
            ].join(' ')}
          >
            {t('GameInvite.dialog.invite')}
          </button>
          <button
            type="button"
            onClick={close}
            className="px-4 py-1.5 rounded-md text-sm text-text-secondary border border-border-subtle hover:bg-bg-elevated"
          >
            {t('GameInvite.dialog.cancel')}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
