import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildAccountActivationFormSchema = (t: TFunction) =>
  z.object({
    token: z.string().trim().min(1, t('Common.validation.required')),
  });

export type AccountActivationFormValues = z.infer<ReturnType<typeof buildAccountActivationFormSchema>>;
