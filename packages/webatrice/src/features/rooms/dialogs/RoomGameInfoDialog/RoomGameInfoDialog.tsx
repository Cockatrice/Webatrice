import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Game, GametypeMap } from '@cockatrice/datatrice';
import { Button, UserBadges } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { formatSpectators } from '@app/utils';

import { gameAge, gameTypeNames } from '../../components/gameRowModel';

export interface RoomGameInfoDialogProps {
  game: Game | null;
  gametypeMap: GametypeMap;
  nowSeconds: number;
  onClose: () => void;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 text-[13px] text-text-primary">{children}</dd>
    </div>
  );
}

export default function RoomGameInfoDialog({ game, gametypeMap, nowSeconds, onClose }: RoomGameInfoDialogProps) {
  const { t } = useTranslation();
  if (!game) {
    return null;
  }
  const { info } = game;
  const formats = gameTypeNames(info, gametypeMap);
  const age = gameAge(info.startTime, nowSeconds);
  const ageText = age.unit === 'new'
    ? t('GameRow.age.new')
    : age.unit === 'minutes' ? t('GameRow.age.minutes', { count: age.count }) : t('GameRow.age.hours', { count: age.count });
  const rules = [
    info.withPassword && t('RoomGameInfoDialog.rule.password'),
    info.onlyBuddies && t('GameRow.restriction.buddiesOnly'),
    info.onlyRegistered && t('GameRow.restriction.registeredOnly'),
    info.shareDecklistsOnLoad && t('GameRow.restriction.openDecklists'),
  ].filter(Boolean);

  return (
    <DialogShell
      isOpen
      handleClose={onClose}
      title={info.description || t('GameRow.untitled', { id: info.gameId })}
      footer={<Button variant="primary" onClick={onClose}>{t('Common.action.close')}</Button>}
    >
      <dl className="divide-y divide-border-subtle/60">
        <Fact label={t('RoomGameInfoDialog.host')}>
          <span className="inline-flex items-center gap-1.5">
            {info.creatorInfo?.name ?? t('RoomGameInfoDialog.unknown')}
            {info.creatorInfo && <UserBadges userLevel={info.creatorInfo.userLevel} size={12} />}
          </span>
        </Fact>
        <Fact label={t('RoomGameInfoDialog.formats')}>{formats.join(', ') || game.gameType || t('RoomGameInfoDialog.unknown')}</Fact>
        <Fact label={t('RoomGameInfoDialog.created')}>{ageText}</Fact>
        <Fact label={t('RoomGameInfoDialog.seats')}>
          {t('DesignSystem.seats', { taken: info.playerCount, max: info.maxPlayers })}
          {info.started && ` · ${t('DesignSystem.availability.started')}`}
        </Fact>
        <Fact label={t('RoomGameInfoDialog.rules')}>{rules.join(' · ') || t('RoomGameInfoDialog.anyone')}</Fact>
        <Fact label={t('RoomGameInfoDialog.spectators')}>{formatSpectators(t, info)}</Fact>
        <Fact label={t('RoomGameInfoDialog.gameId')}>{info.gameId}</Fact>
      </dl>
    </DialogShell>
  );
}
