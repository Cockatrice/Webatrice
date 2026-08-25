import { useMemo } from 'react';
import { Users, UserRoundPlus } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { UserRows } from '@app/components';
import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

/**
 * Right-column user panel. Two sections:
 *   • Buddies (top)         — global; from server.buddyList
 *   • All users on server   — global; from server.sortedUsers
 *
 * Users in the *current room* are not surfaced here on purpose — that
 * data (rooms.getSortedRoomUsers) is available but the split is meant
 * to be server-scoped, per the fancy webatrice design.
 */
export default function RoomUsers() {
  const buddiesMap = useAppSelector(server.Selectors.getBuddyList);
  const allUsers = useAppSelector(server.Selectors.getSortedUsers);

  // Buddies filtered to those currently connected to the server. A
  // buddy shows up in `allUsers` iff they're online, so a Set-lookup
  // against user names does the intersection. Offline buddies stay
  // hidden until they log back in.
  const onlineBuddies = useMemo(() => {
    const onlineNames = new Set(allUsers.map((u) => u.name));
    return Object.values(buddiesMap)
      .filter((b) => onlineNames.has(b.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buddiesMap, allUsers]);

  return (
    // Two independent cards with a gap between them so the Buddies
    // panel reads as its own thing rather than a subsection of Players.
    <aside className="flex h-full flex-col gap-3">
      <Panel
        icon={<UserRoundPlus size={14} className="text-accent" />}
        title="Buddies"
        subtitle={`${onlineBuddies.length} online`}
        empty="No buddies online right now."
        users={onlineBuddies}
      />
      <Panel
        icon={<Users size={14} className="text-text-muted" />}
        title="Players Online"
        subtitle={`${allUsers.length} connected`}
        empty="No one else online."
        users={allUsers}
      />
    </aside>
  );
}

interface PanelProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  empty: string;
  users: ServerInfo_User[];
}

/** Self-contained card (border + rounded surface). Each panel renders
 *  as its own visual unit so the two lists don't blur into one column. */
function Panel({ icon, title, subtitle, empty, users }: PanelProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border-subtle flex items-center gap-2">
        {icon}
        <h3 className="font-modern text-xs font-bold uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
        <span className="ml-auto text-[0.65rem] text-text-muted tabular-nums">{subtitle}</span>
      </div>
      <UserRows users={users} empty={empty} />
    </div>
  );
}
