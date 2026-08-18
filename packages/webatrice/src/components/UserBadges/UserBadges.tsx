import { Gavel, Shield, ShieldCheck } from 'lucide-react';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

/**
 * Compact role badges shown next to a user's name in every user list:
 *   • Admin      — red    ShieldCheck  (highest privilege)
 *   • Moderator  — blue   Shield
 *   • Judge      — amber  Gavel        (game-time judge, distinct role from mod)
 *
 * Mirrors Cockatrice desktop's colored user-icon overlays (see
 * `UserListWidget::processUserInfo` — desktop paints an admin/mod
 * badge on the avatar, plus a gavel for judges). We render the badges
 * inline as text-adjacent icons since the sidebar doesn't have room
 * for a full avatar overlay.
 *
 * `userLevel` is a bitmask so the flags aren't mutually exclusive —
 * a moderator promoted to admin has BOTH bits, but the higher-tier
 * label wins visually to avoid stacking two shields. Judge is
 * orthogonal and always shows when set.
 *
 * Renders nothing when the user is a plain registered / unregistered
 * user — no wasted whitespace next to normal names.
 */
export function UserBadges({
  userLevel,
  size = 11,
  className = '',
}: {
  userLevel: number;
  size?: number;
  className?: string;
}) {
  const isAdmin =
    (userLevel & ServerInfo_User_UserLevelFlag.IsAdmin)
      === ServerInfo_User_UserLevelFlag.IsAdmin;
  const isModerator =
    (userLevel & ServerInfo_User_UserLevelFlag.IsModerator)
      === ServerInfo_User_UserLevelFlag.IsModerator;
  const isJudge =
    (userLevel & ServerInfo_User_UserLevelFlag.IsJudge)
      === ServerInfo_User_UserLevelFlag.IsJudge;

  if (!isAdmin && !isModerator && !isJudge) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}>
      {isAdmin && (
        <span title="Admin" className="inline-flex">
          <ShieldCheck size={size} className="text-red-400" aria-label="Admin" />
        </span>
      )}
      {!isAdmin && isModerator && (
        <span title="Moderator" className="inline-flex">
          <Shield size={size} className="text-blue-400" aria-label="Moderator" />
        </span>
      )}
      {isJudge && (
        <span title="Judge" className="inline-flex">
          <Gavel size={size} className="text-amber-400" aria-label="Judge" />
        </span>
      )}
    </span>
  );
}
