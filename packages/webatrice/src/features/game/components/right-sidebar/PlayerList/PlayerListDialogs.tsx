import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { DialogShell } from '@app/dialogs';
import { formatAccountAge, formatUserLevel } from '@app/utils';

const MODAL_BUTTON_PRIMARY =
  'px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-on-accent '
  + 'hover:bg-accent-hover shadow-glow board-motion transition-colors '
  + 'disabled:opacity-50 disabled:cursor-not-allowed';

// ---------------------------------------------------------------------
// User details — mirrors Cockatrice's `UserInfoBox` (user_info_box.cpp).
// Read-only view of the target's ServerInfo_User. User level through the
// shared formatter; avatar preferred from the profile URL when present (fancy
// carries profile metadata alongside the wire's ServerInfo_User; both
// paths render the same avatar column).
// ---------------------------------------------------------------------

export const UserDetailsModal = memo(function UserDetailsModal({
  user,
  onClose,
}: {
  user: ServerInfo_User;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <DialogShell
      isOpen
      handleClose={onClose}
      title={user.name || t('PlayerListDialogs.unknownUser')}
      footer={(
        <button type="button" onClick={onClose} className={MODAL_BUTTON_PRIMARY} data-autofocus>
          {t('PlayerListDialogs.close')}
        </button>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[80px,1fr] gap-3 items-start">
          <div
            className={
              'h-20 w-20 rounded-md bg-gradient-to-br from-accent-secondary '
              + 'to-accent flex items-center justify-center text-white text-2xl '
              + 'font-modern font-bold shrink-0'
            }
            aria-hidden
          >
            {(user.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm min-w-0">
            {user.realName && (
              <>
                <dt className="text-text-muted">{t('PlayerListDialogs.realName')}</dt>
                <dd className="text-text-primary truncate">{user.realName}</dd>
              </>
            )}
            {user.country && (
              <>
                <dt className="text-text-muted">{t('PlayerListDialogs.country')}</dt>
                <dd className="text-text-primary uppercase">{user.country}</dd>
              </>
            )}
            <dt className="text-text-muted">{t('PlayerListDialogs.accountAge')}</dt>
            <dd className="text-text-primary">{formatAccountAge(t, user.accountageSecs, user.userLevel, i18n.language)}</dd>
            <dt className="text-text-muted">{t('PlayerListDialogs.userLevel')}</dt>
            <dd className="text-text-primary">{formatUserLevel(t, user.userLevel, user.privlevel)}</dd>
          </dl>
        </div>
      </div>
    </DialogShell>
  );
});
