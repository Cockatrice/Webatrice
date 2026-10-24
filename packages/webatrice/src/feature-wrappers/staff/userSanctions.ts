import type { ModerationAction, ModerationMenuGroups } from '@app/feature-widgets/moderation';

export function menuAllows(groups: ModerationMenuGroups, action: ModerationAction): boolean {
  return groups.some((group) => group.some((entry) => entry.action === action && !entry.disabled));
}
