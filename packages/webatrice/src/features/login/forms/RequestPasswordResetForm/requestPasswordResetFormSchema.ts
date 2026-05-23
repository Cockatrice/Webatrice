import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { HostDTO } from '@app/services';

export const buildRequestPasswordResetFormSchema = (t: TFunction, isMFA: boolean) =>
  z.object({
    userName: z.string().trim().min(1, t('Common.validation.required')),
    email: isMFA
      ? z.string().trim().min(1, t('Common.validation.required'))
      : z.string().trim().optional(),
    selectedHost: z.custom<HostDTO>((v) => v !== undefined && v !== null, {
      message: t('Common.validation.required'),
    }),
  });

export type RequestPasswordResetFormValues = z.infer<
  ReturnType<typeof buildRequestPasswordResetFormSchema>
>;
