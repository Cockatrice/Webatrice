import { forwardRef, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';
import { Flag, MoreHorizontal, UserCircle, UserRoundMinus, UserRoundPlus, Volume2, VolumeX } from 'lucide-react';

import { Avatar, Button, Menu, UserBadges, useUserMenuSlot, type MenuAnchor } from '@app/components';
import { useReportUser } from '@app/dialogs';
import { CountryFlag } from './CountryFlag';
import type { PeerViewModel } from './usePeer';
import { RouteEnum } from '@app/types';
import { formatAccountAge, formatUserLevel } from '@app/utils';

interface ProfileCardProps {
  name: string;
  peer: PeerViewModel;
  onDone: () => void;
}

const ProfileCard = forwardRef<HTMLDivElement, ProfileCardProps>(function ProfileCard({ name, peer, onDone }, ref) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const Slot = useUserMenuSlot();
  const moreRef = useRef<HTMLButtonElement>(null);
  const [moreAnchor, setMoreAnchor] = useState<MenuAnchor | null>(null);
  const { canReportUser, openReportUser } = useReportUser();
  const info = peer.userInfo;
  const act = (fn: () => void) => () => {
    fn();
    onDone();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('ChatDock.profile.label', { name })}
      className="pointer-events-auto w-[300px] rounded-ui-lg border border-border-strong bg-bg-surface p-4 shadow-pop"
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} size={48} src={peer.avatarUrl ?? undefined} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-text-primary">
            <span className="truncate">{name}</span>
            <CountryFlag cc={info?.country} />
            {info && <UserBadges userLevel={info.userLevel} size={13} />}
          </p>
          <p className="text-[12px] text-text-muted">
            {info
              ? [...new Set([
                formatUserLevel(t, info.userLevel, info.privlevel),
                formatAccountAge(t, info.accountageSecs, info.userLevel, i18n.language),
              ])].join(' · ')
              : t('ChatDock.profile.loading')}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {Slot && (
          <Button
            ref={moreRef}
            size="sm"
            icon={<MoreHorizontal size={13} />}
            aria-haspopup="menu"
            aria-expanded={moreAnchor !== null}
            onClick={(event) => setMoreAnchor({ rect: event.currentTarget.getBoundingClientRect(), placement: 'below' })}
          >
            {t('ChatDock.profile.more')}
          </Button>
        )}
        <Button
          size="sm"
          icon={<UserCircle size={13} />}
          onClick={act(() => navigate(generatePath(RouteEnum.PLAYER, { name })))}
        >
          {t('ChatDock.profile.openPage')}
        </Button>
        {peer.isABuddy ? (
          <Button size="sm" variant="quiet" icon={<UserRoundMinus size={13} />} disabled={!peer.canEditLists} onClick={peer.onRemoveBuddy}>
            {t('ChatDock.profile.removeBuddy')}
          </Button>
        ) : (
          <Button size="sm" variant="quiet" icon={<UserRoundPlus size={13} />} disabled={!peer.canEditLists} onClick={peer.onAddBuddy}>
            {t('ChatDock.profile.addBuddy')}
          </Button>
        )}
        {peer.isIgnored ? (
          <Button size="sm" variant="quiet" icon={<Volume2 size={13} />} disabled={!peer.canEditLists} onClick={peer.onRemoveIgnore}>
            {t('ChatDock.profile.unignore')}
          </Button>
        ) : (
          <Button size="sm" variant="quiet" icon={<VolumeX size={13} />} disabled={!peer.canEditLists} onClick={peer.onAddIgnore}>
            {t('ChatDock.profile.ignore')}
          </Button>
        )}
        {canReportUser(name) && (
          <Button
            size="sm"
            variant="quiet"
            icon={<Flag size={13} />}
            onClick={act(() => openReportUser({ userName: name, chatContext: peer.getChatContext() }))}
          >
            {t('ChatDock.profile.report')}
          </Button>
        )}
      </div>
      {Slot && moreAnchor && (
        <Menu
          anchor={moreAnchor}
          label={t('ChatDock.profile.moreLabel', { name })}
          onClose={() => setMoreAnchor(null)}
          triggerRef={moreRef}
        >
          <Slot
            userName={name}
            userLevel={info?.userLevel}
            onClose={() => {
              setMoreAnchor(null);
              onDone();
            }}
          />
        </Menu>
      )}
    </div>
  );
});

export default ProfileCard;
