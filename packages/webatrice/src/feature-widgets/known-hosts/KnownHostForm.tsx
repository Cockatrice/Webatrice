import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';

import { InputField } from '@app/components';
import type { HostDTO } from '@app/services';

import { buildKnownHostFormSchema, type KnownHostFormValues } from './knownHostFormSchema';

export type { KnownHostFormValues };

interface KnownHostFormProps {
  host?: HostDTO;
  onRemove: (host: HostDTO) => void;
  onSubmit: (values: KnownHostFormValues) => void;
}

const KnownHostForm = ({ host, onRemove, onSubmit }: KnownHostFormProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<KnownHostFormValues>({
    defaultValues: {
      id: host?.id,
      name: host?.name ?? '',
      host: host?.host ?? '',
      port: host?.port ?? '',
    },
    resolver: zodResolver(buildKnownHostFormSchema(t)),
  });

  const submit = handleSubmit(onSubmit);

  const handleRemoveClick = () => {
    if (!host) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onRemove(host);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('Common.label.hostName')}
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />
      <Controller
        name="host"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('Common.label.hostAddress')}
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />
      <Controller
        name="port"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('Common.label.port')}
            type="number"
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />

      <button
        type="submit"
        className="w-full px-4 py-2.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
      >
        {host ? t('Common.label.saveChanges') : t('KnownHostForm.label.add')}
      </button>

      <div className="flex items-center justify-between pt-1">
        <div>
          {host && (
            <button
              type="button"
              onClick={handleRemoveClick}
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                confirmDelete
                  ? 'bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
              ].join(' ')}
            >
              {!confirmDelete ? t('Common.label.delete') : t('Common.label.confirmSure')}
            </button>
          )}
        </div>
        <a
          href="https://github.com/Cockatrice/Cockatrice/wiki/Public-Servers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          {t('KnownHostForm.label.find')}
          <ExternalLink size={12} />
        </a>
      </div>
    </form>
  );
};

export default KnownHostForm;
