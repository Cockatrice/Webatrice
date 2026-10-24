import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { z } from 'zod';
import { FolderPlus } from 'lucide-react';

import { checkNewFolderName } from '../deckFolders';
import { DeckDialogFrame } from './DeckDialogFrame';

export interface CreateFolderDialogProps {
  open: boolean;
  parentPath: string;
  siblings: readonly string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function buildCreateFolderSchema(t: TFunction, parentPath: string, siblings: readonly string[]) {
  return z.object({
    name: z.string().superRefine((value, ctx) => {
      const checked = checkNewFolderName(value, parentPath, siblings);
      if ('problem' in checked) {
        ctx.addIssue({ code: 'custom', message: t(`CreateFolder.problem.${checked.problem}`) });
      }
    }),
  });
}

type CreateFolderValues = z.infer<ReturnType<typeof buildCreateFolderSchema>>;

export function CreateFolderDialog({ open, parentPath, siblings, onClose, onCreate }: CreateFolderDialogProps) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildCreateFolderSchema(t, parentPath, siblings), [t, parentPath, siblings]);
  const { control, handleSubmit, reset } = useForm<CreateFolderValues>({
    defaultValues: { name: '' },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!open) {
      reset({ name: '' });
    }
  }, [open, reset]);
  const titleId = useId();

  if (!open) {
    return null;
  }

  const submit = handleSubmit(({ name }) => {
    const checked = checkNewFolderName(name, parentPath, siblings);
    if ('name' in checked) {
      onCreate(checked.name);
    }
  });

  return (
    <DeckDialogFrame onClose={onClose} titleId={titleId}>
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('CreateFolder.title')}</h2>
        </div>
        <div className="px-5 py-4">
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('CreateFolder.label')}
                </span>
                <input
                  {...field}
                  type="text"
                  autoFocus
                  aria-invalid={fieldState.invalid}
                  className={[
                    'mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary',
                    'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
                  ].join(' ')}
                />
                {fieldState.error && (
                  <span role="alert" className="mt-1 block text-xs text-danger">{fieldState.error.message}</span>
                )}
              </label>
            )}
          />
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t('CreateFolder.cancel')}
          </button>
          <button
            type="submit"
            className={[
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold',
              'bg-accent text-on-accent hover:bg-accent-hover',
            ].join(' ')}
          >
            <FolderPlus size={13} /> {t('CreateFolder.create')}
          </button>
        </div>
      </form>
    </DeckDialogFrame>
  );
}
