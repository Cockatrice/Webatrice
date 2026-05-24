import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { HostDTO } from '@app/services';

export const buildLoginFormSchema = (t: TFunction) =>
  z.object({
    userName: z.string().trim().min(1, t('Common.validation.required')),
    password: z.string(),
    remember: z.boolean(),
    autoConnect: z.boolean(),
    selectedHost: z.custom<HostDTO>((v) => v !== undefined && v !== null, {
      message: t('Common.validation.required'),
    }),
  });

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginFormSchema>>;
