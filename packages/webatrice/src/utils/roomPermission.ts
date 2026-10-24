import type { ServerInfo_Room } from '@cockatrice/sockatrice/generated';

export function getRoomPermissionDisplay(
  { permissionlevel, privilegelevel }: Pick<ServerInfo_Room, 'permissionlevel' | 'privilegelevel'>,
): string {
  const permission = (permissionlevel ?? '').toLowerCase();
  const display = permission !== 'none' ? permission : (privilegelevel ?? '').toLowerCase();
  return display || 'none';
}
