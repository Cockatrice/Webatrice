import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, generatePath } from 'react-router-dom';
import { Eye, LogIn, MessageSquare, MoreHorizontal, Send, Swords, UserRoundPlus, Volume2 } from 'lucide-react';

import { Avatar, Button, IconButton, SeatDots, UserActionsMenu, UserBadges, useUserDisplay, type MenuAnchor } from '@app/components';
import { CountryFlag } from '@app/feature-widgets/chat-dock';
import { RouteEnum } from '@app/types';
import { cx } from '@app/utils';

import { minutesSince, type Activity } from './buddyActivity';
import type { PersonRow } from './peopleGroups';
import type { OnlineBuddy } from './usePeople';

const UNREAD_BADGE = cx(
  'pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center',
  'rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent',
);

export function PresenceAvatar({ name, online, size }: { name: string; online: boolean; size: number }) {
  return (
    <span className="relative shrink-0">
      <Avatar name={name} size={size} />
      <span
        aria-hidden
        className={cx(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-bg-surface',
          online ? 'bg-success' : 'bg-text-muted',
          size >= 40 ? 'h-3.5 w-3.5' : 'h-3 w-3',
        )}
      />
    </span>
  );
}

function ProfileLink({ name, className }: { name: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={generatePath(RouteEnum.PLAYER, { name })}
      aria-label={t('People.action.profile', { name })}
      className={cx(
        'truncate rounded-ui-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
    >
      {name}
    </NavLink>
  );
}

export function PersonMenuButton({ person }: { person: PersonRow }) {
  const { t } = useTranslation();
  const display = useUserDisplay(person.name);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = () => setAnchor(null);
  const after = (fn: () => void) => () => {
    fn();
    close();
  };
  return (
    <>
      <IconButton
        ref={triggerRef}
        size="sm"
        label={t('People.action.more', { name: person.name })}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor({ rect: event.currentTarget.getBoundingClientRect(), placement: 'below', align: 'end' })}
      >
        <MoreHorizontal size={15} />
      </IconButton>
      {anchor && (
        <UserActionsMenu
          anchor={anchor}
          triggerRef={triggerRef}
          onClose={close}
          name={person.name}
          userLevel={person.user.userLevel}
          isABuddy={display.isABuddy}
          isIgnored={display.isIgnored}
          onAddBuddy={after(display.onAddBuddy)}
          onRemoveBuddy={after(display.onRemoveBuddy)}
          onAddIgnore={after(display.onAddIgnore)}
          onRemoveIgnore={after(display.onRemoveIgnore)}
        />
      )}
    </>
  );
}

export function ActivityLine({ activity }: { activity: Activity }) {
  const { t } = useTranslation();
  if (activity.kind === 'idle' || activity.kind === 'unknown') {
    return (
      <span className="block truncate text-[12.5px] text-text-muted">
        {t(activity.kind === 'idle' ? 'People.activity.idle' : 'People.activity.unknown')}
      </span>
    );
  }
  const description = activity.game.description || t('People.activity.untitled', { gameId: activity.game.gameId });
  if (activity.kind === 'waiting') {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-success">
        <LogIn size={12} aria-hidden className="shrink-0" />
        <span className="truncate">
          {t(activity.hosting ? 'People.activity.hosting' : 'People.activity.waiting', {
            description, room: activity.room, open: activity.open,
          })}
        </span>
        <SeatDots taken={activity.game.playerCount} max={activity.game.maxPlayers} size={7} />
      </span>
    );
  }
  const minutes = minutesSince(activity.startTime, Date.now());
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-info">
      <Swords size={12} aria-hidden className="shrink-0" />
      <span className="truncate">
        {minutes
          ? t('People.activity.playing', { description, room: activity.room, minutes })
          : t('People.activity.playingNoTime', { description, room: activity.room })}
      </span>
    </span>
  );
}

function MessageButton({ name, unread, disabled, onClick }: { name: string; unread: number; disabled?: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="relative">
      <Button
        size="sm"
        icon={<MessageSquare size={14} />}
        disabled={disabled}
        onClick={onClick}
        aria-label={unread > 0 ? t('People.action.messageUnread', { name, count: unread }) : t('People.action.messageLabel', { name })}
      >
        {t('People.action.message')}
      </Button>
      {unread > 0 && <span aria-hidden className={UNREAD_BADGE}>{unread}</span>}
    </span>
  );
}

export interface BuddyCardProps {
  buddy: OnlineBuddy;
  busy: boolean;
  onJoin: () => void;
  onWatch: () => void;
  onInvite: () => void;
  onMessage: () => void;
}

export function BuddyCard({ buddy, busy, onJoin, onWatch, onInvite, onMessage }: BuddyCardProps) {
  const { t } = useTranslation();
  const { name, user, activity, action } = buddy;
  let primary: ReactNode = null;
  if (action === 'join') {
    primary = (
      <Button
        size="sm"
        variant="primary"
        icon={<LogIn size={14} />}
        disabled={busy}
        onClick={onJoin}
        aria-label={t('People.action.joinLabel', { name })}
      >
        {t('People.action.join')}
      </Button>
    );
  } else if (action === 'watch') {
    primary = (
      <Button size="sm" icon={<Eye size={14} />} disabled={busy} onClick={onWatch} aria-label={t('People.action.watchLabel', { name })}>
        {t('People.action.watch')}
      </Button>
    );
  } else if (action === 'invite') {
    primary = (
      <Button size="sm" icon={<Send size={14} />} onClick={onInvite} aria-label={t('People.action.inviteLabel', { name })}>
        {t('People.action.invite')}
      </Button>
    );
  }
  return (
    <li className="flex items-center gap-3.5 rounded-ui-lg border border-border-subtle bg-bg-surface px-4 py-3 shadow-panel">
      <PresenceAvatar name={name} online size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <ProfileLink name={name} className="text-[15px] font-semibold text-text-primary" />
          <CountryFlag cc={user.country} />
          <UserBadges userLevel={user.userLevel} />
        </span>
        <span className="mt-1 block">
          <ActivityLine activity={activity} />
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {primary && <span className="flex justify-end">{primary}</span>}
        <MessageButton name={name} unread={buddy.unread} onClick={onMessage} />
        <PersonMenuButton person={buddy} />
      </span>
    </li>
  );
}

export function CompactPerson({ person, children }: { person: PersonRow; children?: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 items-center gap-2 rounded-ui px-2.5 hover:bg-bg-elevated/60">
      <PresenceAvatar name={person.name} online={person.online} size={22} />
      <ProfileLink
        name={person.name}
        className={cx('min-w-0 text-[12.5px]', person.online ? 'text-text-primary' : 'text-text-secondary')}
      />
      <CountryFlag cc={person.user.country} />
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function OtherOnlineActions({ person, canEdit, onMessage, onAdd }: {
  person: PersonRow;
  canEdit: boolean;
  onMessage: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IconButton size="sm" label={t('People.action.messageLabel', { name: person.name })} onClick={onMessage}>
        <MessageSquare size={13} />
      </IconButton>
      <IconButton size="sm" label={t('People.action.addBuddy', { name: person.name })} disabled={!canEdit} onClick={onAdd}>
        <UserRoundPlus size={13} />
      </IconButton>
    </>
  );
}

export function IgnoredRow({ person, canEdit, onRemove }: { person: PersonRow; canEdit: boolean; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-2 rounded-ui px-2.5 py-1 hover:bg-bg-elevated/60">
      <Avatar name={person.name} size={20} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary">{person.name}</span>
      <IconButton size="sm" label={t('People.action.unignore', { name: person.name })} disabled={!canEdit} onClick={onRemove}>
        <Volume2 size={13} />
      </IconButton>
    </li>
  );
}
