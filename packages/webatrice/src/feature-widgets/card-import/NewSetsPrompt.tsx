import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { useDialogFocus } from '@app/hooks';
import type { UnknownSetsAnswer } from '@app/services';

export type NewSetsChoice = UnknownSetsAnswer | 'view';

export interface NewSetsPromptProps {
  codes: readonly string[];
  onAnswer: (choice: NewSetsChoice) => void;
}

const NewSetsPrompt = ({ codes, onAnswer }: NewSetsPromptProps) => {
  const { t } = useTranslation();
  const { getDialogProps } = useDialogFocus({ isOpen: codes.length > 0, modal: false });
  if (codes.length === 0) {
    return null;
  }
  return (
    <Alert {...getDialogProps()} severity="warning" role="alertdialog" aria-label={t('CardDatabaseOverview.newSets.title')}>
      <strong>{t('CardDatabaseOverview.newSets.title')}</strong>
      <div>{t('CardDatabaseOverview.newSets.text', { count: codes.length, codes: codes.join(', ') })}</div>
      <div className="cardDatabase-actions">
        <Button onClick={() => onAnswer('enable')}>{t('CardDatabaseOverview.newSets.yes')}</Button>
        <Button onClick={() => onAnswer('enable-always')}>{t('CardDatabaseOverview.newSets.yesAlways')}</Button>
        <Button onClick={() => onAnswer('keep-disabled')}>{t('CardDatabaseOverview.newSets.no')}</Button>
        <Button onClick={() => onAnswer('view')}>{t('CardDatabaseOverview.newSets.view')}</Button>
      </div>
    </Alert>
  );
};

export default NewSetsPrompt;
