import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CloseIcon from '@mui/icons-material/Close';

import CardDatabaseOverview from './CardDatabaseOverview';
import CardImportForm from './CardImportForm';
import EditTokens from './EditTokens';
import ManageSets from './ManageSets';

import './CardImportDialog.css';

export const CARD_DATABASE_TABS = ['import', 'database', 'sets', 'tokens'] as const;
export type CardDatabaseTab = (typeof CARD_DATABASE_TABS)[number];

export interface CardImportDialogProps {
  isOpen: boolean;
  handleClose: () => void;
  initialTab?: CardDatabaseTab;
}

const CardImportDialog = ({ handleClose, isOpen, initialTab = 'import' }: CardImportDialogProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CardDatabaseTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const viewSets = () => setTab('sets');

  return (
    <Dialog onClose={handleClose} open={isOpen} maxWidth="md" fullWidth>
      <DialogTitle className="dialog-title">
        {t('CardImportDialog.title')}

        <IconButton onClick={handleClose} size="large" aria-label={t('CardImportDialog.close')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, next: CardDatabaseTab) => setTab(next)}
        variant="scrollable"
        aria-label={t('CardImportDialog.title')}
      >
        {CARD_DATABASE_TABS.map((key) => (
          <Tab
            key={key}
            value={key}
            label={t(`CardImportDialog.tab.${key}`)}
            id={`cardDb-tab-${key}`}
            aria-controls={`cardDb-tabpanel-${key}`}
          />
        ))}
      </Tabs>
      <DialogContent id={`cardDb-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`cardDb-tab-${tab}`}>
        {tab === 'import' && <CardImportForm onSubmit={handleClose} onViewSets={viewSets} />}
        {tab === 'database' && <CardDatabaseOverview onViewSets={viewSets} />}
        {tab === 'sets' && <ManageSets onSaved={handleClose} onCancel={handleClose} />}
        {tab === 'tokens' && <EditTokens />}
      </DialogContent>
    </Dialog>
  );
};

export default CardImportDialog;
