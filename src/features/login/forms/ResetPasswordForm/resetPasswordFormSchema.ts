import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { HostDTO } from '@app/services';

export const buildResetPasswordFormSchema = (t: TFunction) =>
  z
    .object({
      userName: z.string().trim().min(1, t('Common.validation.required')),
      token: z.string().trim().min(1, t('Common.validation.required')),
      newPassword: z
        .string()
        .min(1, t('Common.validation.required'))
        .min(8, t('Common.validation.minChars', { count: 8 })),
      passwordAgain: z.string().min(1, t('Common.validation.required')),
      selectedHost: z.custom<HostDTO>((v) => v !== undefined && v !== null, {
        message: t('Common.validation.required'),
      }),
    })
    .refine((data) => data.newPassword === data.passwordAgain, {
      path: ['passwordAgain'],
      message: t('Common.validation.passwordsMustMatch'),
    });

export type ResetPasswordFormValues = z.infer<ReturnType<typeof buildResetPasswordFormSchema>>;
