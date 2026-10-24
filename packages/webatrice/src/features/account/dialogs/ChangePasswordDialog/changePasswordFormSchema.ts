import { z } from 'zod';
import type { TFunction } from 'i18next';

import { MAX_NAME_LENGTH } from '../accountLimits';

export const MIN_PASSWORD_LENGTH = 8;

export const buildChangePasswordFormSchema = (t: TFunction) => {
  const required = t('Common.validation.required');
  const tooLong = t('AccountDialogs.validation.maxChars', { count: MAX_NAME_LENGTH });

  return z
    .object({
      oldPassword: z.string().min(1, required).max(MAX_NAME_LENGTH, tooLong),
      newPassword: z
        .string()
        .min(1, required)
        .min(MIN_PASSWORD_LENGTH, t('Common.validation.minChars', { count: MIN_PASSWORD_LENGTH }))
        .max(MAX_NAME_LENGTH, tooLong),
      newPasswordConfirm: z.string().min(1, required),
    })
    .refine((data) => data.newPassword === data.newPasswordConfirm, {
      path: ['newPasswordConfirm'],
      message: t('Common.validation.passwordsMustMatch'),
    });
};

export type ChangePasswordFormValues = z.infer<ReturnType<typeof buildChangePasswordFormSchema>>;
