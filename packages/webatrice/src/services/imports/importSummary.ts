export type ImportSkipReason = 'duplicate' | 'unsupported';

export type ImportFailReason = 'too-large' | 'invalid' | 'save-failed';

export interface ImportedFile {
  name: string;
  folder?: string;
  replaced?: boolean;
}

export interface ImportIssue<R extends string> {
  name: string;
  reason: R;
  detail?: string;
}

export interface ImportSummary {
  imported: ImportedFile[];
  skipped: ImportIssue<ImportSkipReason>[];
  failed: ImportIssue<ImportFailReason>[];
}

export interface ImportFileOptions {
  relativePathOf?: (file: File) => string;
  isCancelled?: () => boolean;
}

export function emptyImportSummary(): ImportSummary {
  return { imported: [], skipped: [], failed: [] };
}

export function relativePathOf(file: File, options: ImportFileOptions = {}): string {
  return (options.relativePathOf?.(file) || file.webkitRelativePath || file.name).replace(/\\/g, '/');
}

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
