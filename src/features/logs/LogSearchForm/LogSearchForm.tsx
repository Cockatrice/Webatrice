import { Form, Field } from 'react-final-form';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';

import { adaptRffField, CheckboxField, InputField } from '@app/components';

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

const LogSearchForm = ({ onSubmit }: LogSearchFormProps) => {
  const { t } = useTranslation();

  return (
    <Form onSubmit={onSubmit}>
      {({ handleSubmit }) => (
        <Paper className="log-search">
          <form className="log-search__form" onSubmit={handleSubmit}>
            <div className="log-search__form-item">
              <Field name="userName">{(p) => <InputField {...adaptRffField(p)} label={t('LogSearchForm.label.userName')} />}</Field>
            </div>
            <div className="log-search__form-item">
              <Field name="ipAddress">{(p) => <InputField {...adaptRffField(p)} label={t('LogSearchForm.label.ipAddress')} />}</Field>
            </div>
            <div className="log-search__form-item">
              <Field name="gameName">{(p) => <InputField {...adaptRffField(p)} label={t('LogSearchForm.label.gameName')} />}</Field>
            </div>
            <div className="log-search__form-item">
              <Field name="gameId">{(p) => <InputField {...adaptRffField(p)} label={t('LogSearchForm.label.gameId')} />}</Field>
            </div>
            <div className="log-search__form-item">
              <Field name="message">{(p) => <InputField {...adaptRffField(p)} label={t('LogSearchForm.label.message')} />}</Field>
            </div>
            <Divider />
            <div className="log-search__form-item log-location">
              <Field name="logLocation.room" type="checkbox">
                {(p) => <CheckboxField {...adaptRffField(p)} label={t('LogSearchForm.label.rooms')} />}
              </Field>
              <Field name="logLocation.game" type="checkbox">
                {(p) => <CheckboxField {...adaptRffField(p)} label={t('LogSearchForm.label.games')} />}
              </Field>
              <Field name="logLocation.chat" type="checkbox">
                {(p) => <CheckboxField {...adaptRffField(p)} label={t('LogSearchForm.label.chats')} />}
              </Field>
            </div>
            <Divider />
            <Button className="log-search__form-submit" color="primary" variant="contained" type="submit">
              {t('LogSearchForm.button.search')}
            </Button>
          </form>
        </Paper>
      )}
    </Form>
  );
};

export default LogSearchForm;
