import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

import UserDisplay from '../UserDisplay/UserDisplay';
import { VirtualRows } from '../VirtualList/VirtualList';

const USER_ROW_HEIGHT = 28;

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
