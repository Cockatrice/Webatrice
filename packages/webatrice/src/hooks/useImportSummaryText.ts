import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';



import type { ImportFailReason, ImportIssue, ImportSkipReason, ImportSummary } from '@app/services';



export type ImportedFileKind = 'replays' | 'cardFiles';



export type ImportSummarySeverity = 'info' | 'warning';



export interface ImportSummaryText {

  headline: string;

  problems: string[];

  severity: ImportSummarySeverity;

}



type ProblemReason = Exclude<ImportSkipReason, 'duplicate'> | ImportFailReason;



const PROBLEM_ORDER: readonly ProblemReason[] = ['unsupported', 'invalid', 'too-large', 'save-failed'];



const IMPORTED_KEYS: Record<ImportedFileKind, string> = {

  replays: 'ImportSummary.imported.replays',

  cardFiles: 'ImportSummary.imported.cardFiles',

};



const REPLAY_PROBLEM_KEYS: Record<ProblemReason, string> = {

  'unsupported': 'ImportSummary.problem.unsupported.replays',

  'invalid': 'ImportSummary.problem.invalid.replays',

  'too-large': 'ImportSummary.problem.too-large.replays',

  'save-failed': 'ImportSummary.problem.save-failed.replays',

};



const CARD_FILE_PROBLEM_KEYS: Record<ProblemReason, string> = {

  'unsupported': 'ImportSummary.problem.unsupported.cardFiles',

  'invalid': 'ImportSummary.problem.invalid.cardFiles',

  'too-large': 'ImportSummary.problem.too-large.cardFiles',

  'save-failed': 'ImportSummary.problem.save-failed.cardFiles',

};



function namesFor(issues: readonly ImportIssue<string>[], reason: string): string[] {

  return issues.filter((issue) => issue.reason === reason).map((issue) => issue.name);

}



export function useImportSummaryText(): (summary: ImportSummary, kind: ImportedFileKind) => ImportSummaryText {

  const { t } = useTranslation();

  return useCallback((summary, kind) => {

    const duplicates = namesFor(summary.skipped, 'duplicate').length;

    const issues = [...summary.skipped, ...summary.failed];

    const problems = PROBLEM_ORDER.flatMap((reason) => {

      const names = namesFor(issues, reason);

      const key = kind === 'replays' ? REPLAY_PROBLEM_KEYS[reason] : CARD_FILE_PROBLEM_KEYS[reason];

      return names.length ? [t(key, { names: names.join(', ') })] : [];

    });

    const headline = [

      t(IMPORTED_KEYS[kind], { count: summary.imported.length }),

      duplicates ? t('ImportSummary.duplicates', { count: duplicates }) : null,

    ].filter(Boolean).join(' ');

    return { headline, problems, severity: problems.length ? 'warning' : 'info' };

  }, [t]);

}

