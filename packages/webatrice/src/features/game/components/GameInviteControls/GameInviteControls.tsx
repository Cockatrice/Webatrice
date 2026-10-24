import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, UserPlus } from 'lucide-react';

import { useGameInvite } from '@app/feature-widgets/game-invite';
import { useLiveServerEndpoint } from '@app/feature-widgets/known-hosts';
import InviteToGameDialog from '../../dialogs/InviteToGameDialog/InviteToGameDialog';

interface GameInviteControlsProps {
  gameId: number;
  className?: string;
}

const BUTTON_CLASS = [
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
  'text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle',
  'disabled:opacity-60 disabled:cursor-not-allowed board-motion transition-colors',
].join(' ');

export default function GameInviteControls({ gameId, className }: GameInviteControlsProps) {
  const { t } = useTranslation();
  const invite = useGameInvite(gameId, useLiveServerEndpoint());
  const [dialogOpen, setDialogOpen] = useState(false);
  const disabled = !invite.link;
  const unavailableReasonId = useId();

  return (
    <div className={['flex items-center gap-1.5', className ?? ''].join(' ')}>
      <button
        type="button"
        onClick={invite.copyLink}
        disabled={disabled}
        title={invite.unavailableReason ?? t('GameInvite.copyLink')}
        aria-label={t('GameInvite.copyLink')}
        aria-describedby={invite.unavailableReason ? unavailableReasonId : undefined}
        className={BUTTON_CLASS}
      >
        <Link size={12} />
      </button>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        title={invite.unavailableReason ?? t('GameInvite.inviteToGame')}
        aria-label={t('GameInvite.inviteToGame')}
        aria-describedby={invite.unavailableReason ? unavailableReasonId : undefined}
        className={BUTTON_CLASS}
      >
        <UserPlus size={12} /> {t('GameInvite.invite')}
      </button>
      {invite.unavailableReason && (
        <span id={unavailableReasonId} className="max-w-48 text-[10px] leading-tight text-text-muted">
          {invite.unavailableReason}
        </span>
      )}
      <InviteToGameDialog
        isOpen={dialogOpen}
        onlyBuddies={invite.onlyBuddies}
        excludeNames={invite.excludeNames}
        onInvite={invite.sendInvite}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
