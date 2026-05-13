export type ImportSource = 'oracle-local-fs';

export class Info {
  id: 'singleton';
  source: ImportSource;
  sourceUrl?: string;
  sourceVersion?: string;
  author?: string;
  createdAt?: string;
  importedAt: string;
}
