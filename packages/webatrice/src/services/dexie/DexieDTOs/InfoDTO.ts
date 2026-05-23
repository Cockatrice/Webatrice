import { Info } from '../types/Info';
import { dexieService } from '../DexieService';

export class InfoDTO extends Info {
  constructor(info?: Partial<Info>) {
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
