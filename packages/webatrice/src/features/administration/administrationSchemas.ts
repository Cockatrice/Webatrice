import { z } from 'zod';
import type { TFunction } from 'i18next';

export const MAX_SHUTDOWN_REASON_LENGTH = 0xfff;
export const MAX_SHUTDOWN_MINUTES = 999;
export const DEFAULT_SHUTDOWN_MINUTES = 5;
const MAX_REPLAY_ID = 2147483647;

export const buildShutdownSchema = (t: TFunction) =>
  z.object({
    reason: z.string().max(MAX_SHUTDOWN_REASON_LENGTH),
    minutes: z.string().trim().regex(/^\d{1,3}$/, t('Administration.validation.minutes', { max: MAX_SHUTDOWN_MINUTES })),
  });

export type ShutdownFormValues = z.infer<ReturnType<typeof buildShutdownSchema>>;

export const buildGrantReplaySchema = (t: TFunction) =>
  z.object({
    replayId: z
      .string()
      .trim()
      .regex(/^\d+$/, t('Administration.validation.replayId'))
      .refine((value) => Number(value) <= MAX_REPLAY_ID, t('Administration.validation.replayId')),
  });

export type GrantReplayFormValues = z.infer<ReturnType<typeof buildGrantReplaySchema>>;

export const buildActivateUserSchema = (t: TFunction) =>
  z.object({
    userName: z.string().trim().min(1, t('Common.validation.required')),
  });

export type ActivateUserFormValues = z.infer<ReturnType<typeof buildActivateUserSchema>>;
