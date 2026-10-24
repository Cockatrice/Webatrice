import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildWarnUserSchema = (t: TFunction) =>
  z.object({
    userName: z.string().trim().min(1, t('Moderation.warn.errorBlankName')),
    reason: z.string().trim().min(1, t('Moderation.warn.errorBlankReason')),
    redact: z.boolean(),
  });

export type WarnUserFormValues = z.infer<ReturnType<typeof buildWarnUserSchema>>;

export const BAN_MAX_DAYS = 10000;
export const BAN_MAX_HOURS = 24;
export const BAN_MAX_MINUTES = 60;

export const buildBanUserSchema = (t: TFunction) =>
  z.object({
    byName: z.boolean(),
    userName: z.string(),
    byIp: z.boolean(),
    address: z.string(),
    byClientId: z.boolean(),
    clientId: z.string(),
    duration: z.enum(['permanent', 'temporary']),
    days: z.number().int().min(0).max(BAN_MAX_DAYS),
    hours: z.number().int().min(0).max(BAN_MAX_HOURS),
    minutes: z.number().int().min(0).max(BAN_MAX_MINUTES),
    reason: z.string(),
    visibleReason: z.string(),
    redact: z.boolean(),
  }).superRefine((values, ctx) => {
    if (!values.byName && !values.byIp && !values.byClientId) {
      ctx.addIssue({ code: 'custom', path: ['byName'], message: t('Moderation.ban.errorNoType') });
      return;
    }
    if (values.byName && !values.userName.trim()) {
      ctx.addIssue({ code: 'custom', path: ['userName'], message: t('Moderation.ban.errorBlankName') });
    }
    if (values.byIp && !values.address.trim()) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: t('Moderation.ban.errorBlankIp') });
    }
    if (values.byClientId && !values.clientId.trim()) {
      ctx.addIssue({ code: 'custom', path: ['clientId'], message: t('Moderation.ban.errorBlankClientId') });
    }
  });

export type BanUserFormValues = z.infer<ReturnType<typeof buildBanUserSchema>>;

export function banMinutes({ duration, days, hours, minutes }: BanUserFormValues): number {
  return duration === 'permanent' ? 0 : days * 24 * 60 + hours * 60 + minutes;
}

export const adminNotesSchema = z.object({ notes: z.string() });

export type AdminNotesFormValues = z.infer<typeof adminNotesSchema>;
