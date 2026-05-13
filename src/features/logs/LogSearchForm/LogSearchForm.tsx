import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';

import { CheckboxField, InputField } from '@app/components';

import './LogSearchForm.css';

export interface LogSearchFormValues {
  userName?: string;
  ipAddress?: string;
  gameName?: string;
  gameId?: string;
  message?: string;
  logLocation?: {
    room?: boolean;
    game?: boolean;
    chat?: boolean;
  };
}

interface LogSearchFormProps {
  onSubmit: (values: LogSearchFormValues) => void;
}

// Defaults are explicit so each Controller receives a defined value.
// RHF treats `undefined` as uncontrolled, which warns on text inputs.
const DEFAULT_VALUES: LogSearchFormValues = {
  userName: '',
  ipAddress: '',
  gameName: '',
  gameId: '',
  message: '',
  logLocation: { room: false, game: false, chat: false },
};

const LogSearchForm = ({ onSubmit }: LogSearchFormProps) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<LogSearchFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  return (
    <Paper className="log-search">
      <form className="log-search__form" onSubmit={handleSubmit(onSubmit)}>
        <div className="log-search__form-item">
          <Controller
            name="userName"
            control={control}
            render={({ field }) => <InputField {...field} value={field.value ?? ''} label={t('LogSearchForm.label.userName')} />}
          />
        </div>
        <div className="log-search__form-item">
          <Controller
            name="ipAddress"
            control={control}
            render={({ field }) => <InputField {...field} value={field.value ?? ''} label={t('LogSearchForm.label.ipAddress')} />}
          />
        </div>
        <div className="log-search__form-item">
          <Controller
            name="gameName"
            control={control}
            render={({ field }) => <InputField {...field} value={field.value ?? ''} label={t('LogSearchForm.label.gameName')} />}
          />
        </div>
        <div className="log-search__form-item">
          <Controller
            name="gameId"
            control={control}
            render={({ field }) => <InputField {...field} value={field.value ?? ''} label={t('LogSearchForm.label.gameId')} />}
          />
        </div>
        <div className="log-search__form-item">
          <Controller
            name="message"
            control={control}
            render={({ field }) => <InputField {...field} value={field.value ?? ''} label={t('LogSearchForm.label.message')} />}
          />
        </div>
        <Divider />
        <div className="log-search__form-item log-location">
          <Controller
            name="logLocation.room"
            control={control}
            render={({ field }) => <CheckboxField {...field} label={t('LogSearchForm.label.rooms')} />}
          />
          <Controller
            name="logLocation.game"
            control={control}
            render={({ field }) => <CheckboxField {...field} label={t('LogSearchForm.label.games')} />}
          />
          <Controller
            name="logLocation.chat"
            control={control}
            render={({ field }) => <CheckboxField {...field} label={t('LogSearchForm.label.chats')} />}
          />
        </div>
        <Divider />
        <Button className="log-search__form-submit" color="primary" variant="contained" type="submit">
          {t('LogSearchForm.button.search')}
        </Button>
      </form>
    </Paper>
  );
};

export default LogSearchForm;
