import { z } from 'zod';
import type { TFunction } from 'i18next';

import { REPORT_CATEGORIES } from './reportCategories';

export const buildReportUserFormSchema = (t: TFunction) =>
  z.object({
    category: z.enum(REPORT_CATEGORIES),
    gameId: z.string().trim().regex(/^\d*$/, t('ReportUserDialog.validation.gameId'))
      .refine((value) => value === '' || Number(value) > 0, t('ReportUserDialog.validation.gameId')),
    description: z.string().trim().min(1, t('ReportUserDialog.validation.description')),
  });

export type ReportUserFormValues = z.infer<ReturnType<typeof buildReportUserFormSchema>>;
