import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

import UserDisplay from '../UserDisplay/UserDisplay';
import { VirtualRows } from '../VirtualList/VirtualList';

// px-3 py-1 text-sm rows: 8px padding + 20px line box.
const USER_ROW_HEIGHT = 28;

// Module-level for stable identity, and keyed by user.name (not slot index) so
// an open UserDisplay action menu can't retarget on a roster reshuffle — see
// webatrice.instructions.md § Virtualized lists.
const renderUserRow = (user: ServerInfo_User) => (
  <div
    key={user.name}
    className="px-3 py-1 text-sm text-text-primary hover:bg-bg-elevated transition-colors cursor-default"
  >
    <UserDisplay user={user} />
  </div>
);

interface UserRowsProps {
  users: ServerInfo_User[];
  empty: string;
}

/** Virtualized user list shared by the room and server "Players Online"
 *  panels: the scrollable body plus its empty state. Callers own the
 *  surrounding card chrome and supply the users and empty-state text. */
export default function UserRows({ users, empty }: UserRowsProps) {
  return (
    <div className="flex-1 min-h-0 py-1">
      {users.length === 0 ? (
        <div className="px-4 py-3 text-xs text-text-muted italic">{empty}</div>
      ) : (
        <VirtualRows items={users} rowHeight={USER_ROW_HEIGHT} renderRow={renderUserRow} />
      )}
    </div>
  );
}
