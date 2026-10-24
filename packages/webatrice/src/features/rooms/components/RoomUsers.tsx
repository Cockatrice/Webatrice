import { Fragment, memo, useCallback } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { Avatar, IconButton, Panel, SectionLabel, TextInput, UserDisplay, VirtualRows } from '@app/components';
import { useUserGames } from '@app/feature-widgets/user-games';
import { useOpenChat } from '@app/feature-widgets/chat-dock';
import { cx } from '@app/utils';

import type { BuddyEntry, PeopleRow, PeopleSection } from './roomPeople';
import { useRoomPeople } from './useRoomPeople';

interface RoomUsersProps {
  roomId: number;
  roomName: string;
}

const ROW_HEIGHT: Record<PeopleRow['kind'], number> = {
  section: 32,
  buddy: 46,
  person: 32,
  preview: 64,
  empty: 30,
};

const SECTION_KEYS = {
  buddies: 'RoomUsers.section.buddies',
  offline: 'RoomUsers.section.offline',
  staff: 'RoomUsers.section.staff',
  everyone: 'RoomUsers.section.everyone',
} as const satisfies Record<PeopleSection, string>;

const peopleRowHeight = (index: number, { items }: { items: PeopleRow[] }) => ROW_HEIGHT[items[index].kind];

export default memo(function RoomUsers({ roomId, roomName }: RoomUsersProps) {
  const { t } = useTranslation();
  const { people, rows, query, setQuery, toggle } = useRoomPeople(roomId);
  const renderRow = useCallback((row: PeopleRow) => (
    <PeopleRowView key={row.key} row={row} roomName={roomName} toggle={toggle} />
  ), [roomName, toggle]);

  return (
    <Panel
      title={t('RoomUsers.title')}
      count={t('RoomUsers.count', { count: people.memberCount, room: roomName })}
      flush
      className="h-full"
      bodyClassName="flex flex-col"
    >
      <div className="shrink-0 px-3 pt-3">
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('RoomUsers.search')}
          aria-label={t('RoomUsers.search')}
        />
      </div>
      <div className="min-h-0 flex-1 px-1.5 pb-2 pt-2">
        <VirtualRows
          aria-label={t('RoomUsers.list', { room: roomName })}
          className="h-full"
          defaultHeight={600}
          items={rows}
          rowHeight={peopleRowHeight}
          renderRow={renderRow}
        />
      </div>
    </Panel>
  );
});

interface PeopleRowProps {
  row: PeopleRow;
  roomName: string;
  toggle: (section: PeopleSection) => void;
}

const PeopleRowView = memo(function PeopleRowView({ row, roomName, toggle }: PeopleRowProps) {
  return (
    <Fragment key={row.key}>
      {row.kind === 'section' && (
        <SectionHeader section={row.section} open={row.open} count={row.count} roomName={roomName} onToggle={toggle} />
      )}
      {row.kind === 'buddy' && <BuddyRow entry={row.entry} roomName={roomName} />}
      {row.kind === 'person' && <PersonRow user={row.user} muted={row.muted} />}
      {row.kind === 'preview' && <EveryonePreview users={row.users} more={row.more} onOpen={() => toggle('everyone')} />}
      {row.kind === 'empty' && <EmptyRow section={row.section} />}
    </Fragment>
  );
});

function SectionHeader({ section, open, count, roomName, onToggle }: {
  section: PeopleSection;
  open: boolean;
  count: number;
  roomName: string;
  onToggle: (section: PeopleSection) => void;
}) {
  const { t } = useTranslation();
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onToggle(section)}
      className={cx(
        'flex h-full w-full items-center gap-1.5 rounded-ui-sm px-2 text-left hover:bg-bg-elevated',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <Chevron size={14} className="shrink-0 text-text-muted" aria-hidden />
      <SectionLabel className="truncate">{t(SECTION_KEYS[section], { room: roomName })}</SectionLabel>
      <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-text-muted">
        {section === 'buddies' ? t('RoomUsers.online', { count }) : count}
      </span>
    </button>
  );
}

const NAME_LINE = cx(
  'flex min-w-0 items-center text-[13px] font-medium text-text-primary [&_a:hover]:text-accent [&_a]:rounded-ui-sm',
  '[&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-accent',
  '[&_img:not([src])]:hidden',
);

function NameLine({ user }: { user: ServerInfo_User }) {
  return (
    <span className={NAME_LINE}>
      <UserDisplay user={user} />
    </span>
  );
}

function BuddyRow({ entry, roomName }: { entry: BuddyEntry; roomName: string }) {
  const { t } = useTranslation();
  const userGames = useUserGames();
  const openChat = useOpenChat();
  const { user, inRoom, hosting } = entry;
  const game = hosting && (hosting.info.description || t('RoomUsers.untitledGame', { id: hosting.info.gameId }));
  const where = game
    ? t('RoomUsers.hosting', { game })
    : inRoom
      ? t('RoomUsers.inRoom', { room: roomName })
      : t('RoomUsers.elsewhere');
  return (
    <div className="flex h-full min-w-0 items-center gap-2.5 rounded-ui-sm px-2 hover:bg-bg-elevated">
      <Avatar name={user.name} size={30} />
      <span className="flex min-w-0 flex-1 flex-col">
        <NameLine user={user} />
        <span className="truncate text-[11.5px] text-text-muted" title={where}>{where}</span>
      </span>
      {userGames && (
        <IconButton size="sm" label={t('RoomUsers.showGames', { name: user.name })} onClick={() => userGames.open(user.name)}>
          <Swords size={14} aria-hidden />
        </IconButton>
      )}
      <IconButton size="sm" label={t('RoomUsers.message', { name: user.name })} onClick={() => openChat(user.name)}>
        <MessageSquare size={14} aria-hidden />
      </IconButton>
    </div>
  );
}

function PersonRow({ user, muted }: { user: ServerInfo_User; muted?: boolean }) {
  return (
    <div className={cx('flex h-full min-w-0 items-center gap-2.5 rounded-ui-sm px-2 hover:bg-bg-elevated', muted && 'opacity-60')}>
      <Avatar name={user.name} size={24} />
      <span className="min-w-0 flex-1">
        <NameLine user={user} />
      </span>
    </div>
  );
}

function EveryonePreview({ users, more, onOpen }: { users: ServerInfo_User[]; more: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const names = users.slice(0, 2).map((u) => u.name).join(', ');
  return (
    <div className="h-full px-2 pt-1">
      <button
        type="button"
        onClick={onOpen}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-ui border border-dashed border-border-strong px-2.5 py-2 text-left',
          'text-[12px] text-text-secondary hover:border-accent/60 hover:text-text-primary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        )}
      >
        <span className="flex shrink-0 items-center -space-x-1.5" aria-hidden>
          {users.map((u) => (
            <span key={u.name} className="rounded-full ring-2 ring-bg-surface">
              <Avatar name={u.name} size={20} />
            </span>
          ))}
        </span>
        <span className="line-clamp-2 min-w-0">{t('RoomUsers.preview', { names, count: more })}</span>
      </button>
    </div>
  );
}

function EmptyRow({ section }: { section: PeopleSection }) {
  const { t } = useTranslation();
  return (
    <p className="flex h-full items-center px-2 text-[12px] italic text-text-muted">
      {t(section === 'buddies' ? 'RoomUsers.empty.buddies' : 'RoomUsers.empty.search')}
    </p>
  );
}
