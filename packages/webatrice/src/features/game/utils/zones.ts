import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import type { ZoneEntry } from '@cockatrice/datatrice';

export function isHiddenZone(zone: Pick<ZoneEntry, 'type'> | undefined): boolean {
  return zone?.type === ServerInfo_Zone_ZoneType.HiddenZone;
}
