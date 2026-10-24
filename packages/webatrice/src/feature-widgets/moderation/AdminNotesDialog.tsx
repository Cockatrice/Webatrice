import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

import { adminNotesSchema, type AdminNotesFormValues } from './moderationFormSchemas';
import { BUTTON_PRIMARY_CLASS, FIELD_CLASS } from './moderationStyles';

export interface AdminNotesDialogProps {
  userName: string;
  notes: string;
  onSubmit: (notes: string) => void;
  onCancel: () => void;
}

const resolver = zodResolver(adminNotesSchema);

const AdminNotesDialog = ({ userName, notes, onSubmit, onCancel }: AdminNotesDialogProps) => {
  const { t } = useTranslation();
  const title = t('Moderation.adminNotes.title', { userName });
  const { control, handleSubmit, formState } = useForm<AdminNotesFormValues>({
    defaultValues: { notes },
    resolver,
  });

  return (
    <DialogShell isOpen handleClose={onCancel} title={title} maxWidth="max-w-xl">
      <form className="flex flex-col gap-3" onSubmit={handleSubmit((values) => onSubmit(values.notes))}>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <textarea {...field} autoFocus rows={10} aria-label={title} className={FIELD_CLASS + ' resize-y font-mono'} />
          )}
        />
        <button type="submit" disabled={!formState.isDirty} className={BUTTON_PRIMARY_CLASS}>
          {t('Moderation.adminNotes.update')}
        </button>
      </form>
    </DialogShell>
  );
};

export default AdminNotesDialog;
