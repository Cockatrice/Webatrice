import { dexieService } from '@app/services';

export async function resetDexie(): Promise<void> {
  await Promise.all([
    dexieService.settings.clear(),
    dexieService.hosts.clear(),
  ]);
}
