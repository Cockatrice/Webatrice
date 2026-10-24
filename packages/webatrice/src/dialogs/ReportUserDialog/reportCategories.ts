export const REPORT_CATEGORIES = [
  'cheating',
  'bug_abuse',
  'harassment',
  'verbal_abuse',
  'hate_speech',
  'spam',
  'other',
] as const;

export type ReportCategory = typeof REPORT_CATEGORIES[number];
