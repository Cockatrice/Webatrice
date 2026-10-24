import { useMemo, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { z } from 'zod';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { DialogShell } from '@app/dialogs';

import { MAX_AVATAR_DIMENSION } from './encodeAvatar';
import { useChangeAvatar } from './useChangeAvatar';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/bmp,.png,.jpg,.jpeg,.bmp';

const buildChangeAvatarFormSchema = (t: TFunction) =>
  z
    .object({ unreadable: z.boolean() })
    .refine((data) => !data.unreadable, {
      path: ['unreadable'],
      message: t('ChangeAvatarDialog.invalidImage'),
    });

type ChangeAvatarFormValues = z.infer<ReturnType<typeof buildChangeAvatarFormSchema>>;

interface ChangeAvatarDialogProps {
  isOpen: boolean;
  handleClose: () => void;
}

const ChangeAvatarForm = ({ handleClose }: { handleClose: () => void }) => {
  const { t } = useTranslation();
  const { preview, pending, decoding, error, pick, submit } = useChangeAvatar(handleClose);
  const resolver = useMemo(() => zodResolver(buildChangeAvatarFormSchema(t)), [t]);

  const { handleSubmit, setValue, trigger, formState: { errors } } = useForm<ChangeAvatarFormValues>({
    defaultValues: { unreadable: false },
    resolver,
  });

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const readable = await pick(e.target.files?.[0] ?? null);
    if (readable === undefined) {
      return;
    }
    setValue('unreadable', !readable);
    await trigger('unreadable');
  };

  const unreadableMessage = errors.unreadable?.message;

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit(submit)}>
      <div
        className="flex items-center justify-center w-full h-[200px] border border-border-subtle rounded-md overflow-hidden"
        aria-live="polite"
      >
        {preview
          ? <img src={preview.url} alt={t('ChangeAvatarDialog.previewAlt')} className="max-w-full max-h-full object-contain" />
          : <span>{unreadableMessage ?? t('ChangeAvatarDialog.noImage')}</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>{t('ChangeAvatarDialog.instructions')}</span>
        <Button component="label" variant="outlined" disabled={pending}>
          {t('ChangeAvatarDialog.browse')}
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            hidden
            disabled={pending}
            aria-label={t('ChangeAvatarDialog.browse')}
            onChange={onFileChange}
          />
        </Button>
      </div>
      <span className="text-xs text-text-muted">
        {t('ChangeAvatarDialog.hint', { size: MAX_AVATAR_DIMENSION })}
      </span>
      {error && <Typography color="error" role="alert">{error}</Typography>}
      <div className="flex justify-end gap-2">
        <Button onClick={handleClose}>{t('AccountDialogs.label.cancel')}</Button>
        <Button type="submit" variant="contained" color="primary" disabled={pending || decoding}>
          {t('AccountDialogs.label.ok')}
        </Button>
      </div>
    </form>
  );
};

const ChangeAvatarDialog = ({ isOpen, handleClose }: ChangeAvatarDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell isOpen={isOpen} handleClose={handleClose} title={t('ChangeAvatarDialog.title')}>
      <ChangeAvatarForm handleClose={handleClose} />
    </DialogShell>
  );
};

export default ChangeAvatarDialog;
