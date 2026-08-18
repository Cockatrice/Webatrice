import { Users } from 'lucide-react';

import { UserDisplay } from '@app/components';
import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

interface ServerUsersProps {
  users: ServerInfo_User[];
}

/** Right-column panel on the Server (lobby) page. Single flat list of
 *  every user currently connected to the server. Same visual chrome
 *  as the Room page's RoomUsers panels but without the Buddies split
 *  — this is the raw connected-users view. */
export default function ServerUsers({ users }: ServerUsersProps) {
  return (
    <aside className="flex h-full flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border-subtle flex items-center gap-2">
        <Users size={14} className="text-text-muted" />
        <h3 className="font-modern text-xs font-bold uppercase tracking-wider text-text-secondary">
          Players Online
        </h3>
        <span className="ml-auto text-[0.65rem] text-text-muted tabular-nums">
          {users.length} connected
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {users.length === 0 && (
          <div className="px-4 py-3 text-xs text-text-muted italic">
            No one connected.
          </div>
        )}
        {users.map((user) => (
          <div
            key={user.name}
            className="px-3 py-1 text-sm text-text-primary hover:bg-bg-elevated transition-colors cursor-default"
          >
            <UserDisplay user={user} />
          </div>
        ))}
      </div>
    </aside>
  );
}
