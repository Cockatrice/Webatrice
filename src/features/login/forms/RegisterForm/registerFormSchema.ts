import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { HostDTO } from '@app/services';

export const buildRegisterFormSchema = (t: TFunction, emailRequired: boolean) => {
  const required = t('Common.validation.required');
  const minPasswordChars = t('Common.validation.minChars', { count: 8 });

  let schema = z
    .object({
      userName: z.string().trim().min(1, required),
      password: z.string().min(1, required).min(8, minPasswordChars),
      passwordConfirm: z.string().min(1, required),
      email: emailRequired ? z.string().trim().min(1, required) : z.string().trim().optional(),
      emailConfirm: emailRequired
        ? z.string().trim().min(1, required)
        : z.string().trim().optional(),
      realName: z.string().trim().optional(),
      country: z.string().optional(),
      selectedHost: z.custom<HostDTO>((v) => v !== undefined && v !== null, {
        message: required,
      }),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      path: ['passwordConfirm'],
      message: t('Common.validation.passwordsMustMatch'),
    });

  if (emailRequired) {
    schema = schema.refine((data) => data.email === data.emailConfirm, {
      path: ['emailConfirm'],
      message: t('Common.validation.emailsMustMatch'),
    });
  }

  return schema;
};

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterFormSchema>>;
