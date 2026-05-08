import { App } from '@app/types';

import { dexieService } from '../DexieService';

export class InfoDTO extends App.Info {
  constructor(info?: Partial<App.Info>) {
    super();
    this.id = 'singleton';
    this.source = info?.source ?? 'oracle-local-fs';
    this.sourceUrl = info?.sourceUrl;
    this.sourceVersion = info?.sourceVersion;
    this.author = info?.author;
    this.createdAt = info?.createdAt;
    this.importedAt = info?.importedAt ?? new Date().toISOString();
  }

  save() {
    return dexieService.info.put(this);
  }

  static get() {
    return dexieService.info.get('singleton');
  }
}

dexieService.info.mapToClass(InfoDTO);
