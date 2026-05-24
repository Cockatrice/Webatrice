import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildKnownHostFormSchema = (t: TFunction) =>
  z.object({
    id: z.number().optional(),
    name: z.string().trim().min(1, t('Common.validation.required')),
    host: z.string().trim().min(1, t('Common.validation.required')),
    port: z.string().min(1, t('Common.validation.required')),
  });

export type KnownHostFormValues = z.infer<ReturnType<typeof buildKnownHostFormSchema>>;
