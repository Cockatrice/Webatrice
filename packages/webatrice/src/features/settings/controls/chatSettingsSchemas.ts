import { z } from 'zod';
import type { TFunction } from 'i18next';

export const MAX_TEXT_LENGTH = 0xfff;

export const buildMessageMacroSchema = (t: TFunction) =>
  z.object({
    message: z
      .string()
      .trim()
      .min(1, t('Common.validation.required'))
      .max(MAX_TEXT_LENGTH, t('SettingsChat.macros.tooLong', { max: MAX_TEXT_LENGTH })),
  });

export type MessageMacroValues = z.infer<ReturnType<typeof buildMessageMacroSchema>>;
