import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import AnchorLink from '@mui/material/Link';

import { InputField } from '@app/components';
import type { HostDTO } from '@app/services';

import { buildKnownHostFormSchema, type KnownHostFormValues } from './knownHostFormSchema';
import './KnownHostForm.css';

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
    if (!host) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onRemove(host);
  };

  return (
    <form className="KnownHostForm" onSubmit={submit}>
      <div className="KnownHostForm-item">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <InputField {...field} label={t('Common.label.hostName')} error={fieldState.error?.message} touched={fieldState.isTouched} />
          )}
        />
      </div>
      <div className="KnownHostForm-item">
        <Controller
          name="host"
          control={control}
          render={({ field, fieldState }) => (
            <InputField {...field} label={t('Common.label.hostAddress')} error={fieldState.error?.message} touched={fieldState.isTouched} />
          )}
        />
      </div>
      <div className="KnownHostForm-item">
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
      </div>

      <Button className="KnownHostForm-submit" color="primary" variant="contained" type="submit">
        {host ? t('Common.label.saveChanges') : t('KnownHostForm.label.add')}
      </Button>

      <div className="KnownHostForm-actions">
        <div className="KnownHostForm-actions__delete">
          {host && (
            <Button color="inherit" onClick={handleRemoveClick}>
              {!confirmDelete ? t('Common.label.delete') : t('Common.label.confirmSure')}
            </Button>
          )}
        </div>
        <AnchorLink href='https://github.com/Cockatrice/Cockatrice/wiki/Public-Servers' target='_blank'>
          {t('KnownHostForm.label.find')}
        </AnchorLink>
      </div>
    </form>
  );
};

export default KnownHostForm;
