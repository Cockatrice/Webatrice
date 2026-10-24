import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { DialogShell } from '@app/dialogs';

import type { LobbyGameFacts } from '../../components/lobby/lobbyGameInfo';

export interface LobbyGameInfoDialogProps {
  isOpen: boolean;
  title: string;
  hostName: string;
  facts: LobbyGameFacts;
  onClose: () => void;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-text-primary">{children}</dd>
    </div>
  );
}

export default function LobbyGameInfoDialog({ isOpen, title, hostName, facts, onClose }: LobbyGameInfoDialogProps) {
  const { t } = useTranslation();
  const yesNo = (value: boolean) => (value ? 'yes' : 'no');
  const format = facts.formats === null
    ? t('LobbyGameInfoDialog.format.unknown')
    : facts.formats.join(', ') || t('LobbyGameInfoDialog.format.any');

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={onClose}
      title={title}
      footer={<Button variant="primary" onClick={onClose} data-autofocus>{t('Common.action.close')}</Button>}
    >
      <dl className="divide-y divide-border-subtle/60">
        <Fact label={t('LobbyGameInfoDialog.row.description')}>
          {facts.description || <span className="text-text-muted">{t('LobbyGameInfoDialog.noDescription')}</span>}
        </Fact>
        <Fact label={t('LobbyGameInfoDialog.row.host')}>{hostName}</Fact>
        <Fact label={t('LobbyGameInfoDialog.row.format')}>{format}</Fact>
        <Fact label={t('LobbyGameInfoDialog.row.seats')}>
          {t('LobbyGameInfoDialog.seats', { taken: facts.seats.taken, max: facts.seats.max })}
        </Fact>
        <Fact label={t('LobbyGameInfoDialog.row.whoCanJoin')}>
          {t('LobbyGameInfoDialog.audience', { audience: facts.audience })}
        </Fact>
        <Fact label={t('LobbyGameInfoDialog.row.password')}>
          {t('LobbyGameInfoDialog.password', { set: yesNo(facts.hasPassword) })}
        </Fact>
        <Fact label={t('LobbyGameInfoDialog.row.spectators')}>
          {t('LobbyGameInfoDialog.spectators', {
            allowed: yesNo(facts.spectators != null),
            chat: yesNo(Boolean(facts.spectators?.canChat)),
            seeAll: yesNo(Boolean(facts.spectators?.seeEverything)),
            needPassword: yesNo(Boolean(facts.spectators?.needPassword)),
          })}
        </Fact>
        <Fact label={t('LobbyGameInfoDialog.row.decklists')}>
          {t('LobbyGameInfoDialog.decklists', { shared: yesNo(facts.shareDecklists) })}
        </Fact>
      </dl>
    </DialogShell>
  );
}
