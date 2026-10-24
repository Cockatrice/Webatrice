import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import type { CardSource } from '@app/services';

import NewSetsPrompt, { type NewSetsChoice } from './NewSetsPrompt';
import { useCardDatabaseOverview } from './useCardDatabaseOverview';

import './CardDatabase.css';

export interface CardDatabaseOverviewProps {
  onViewSets?: () => void;
}

const REMOVABLE: ReadonlyArray<CardSource['kind']> = ['custom', 'spoiler', 'legacy'];

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');

const CardDatabaseOverview = ({ onViewSets }: CardDatabaseOverviewProps) => {
  const { t } = useTranslation();
  const overview = useCardDatabaseOverview();
  const fileInput = useRef<HTMLInputElement>(null);
  const disabled = overview.busy !== null;

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) {
      void overview.addCustomFiles(files);
    }
  };

  const answer = async (choice: NewSetsChoice) => {
    if (choice === 'view') {
      await overview.answerUnknownSets('keep-disabled');
      onViewSets?.();
      return;
    }
    await overview.answerUnknownSets(choice);
  };

  if (overview.loading) {
    return <CircularProgress size={32} />;
  }

  const { summary } = overview;
  const hasData = Boolean(summary && summary.cards + summary.tokens > 0);

  return (
    <div className="cardDatabase-overview">
      <p>{hasData ? t('CardDatabaseOverview.summary', { ...summary }) : t('CardDatabaseOverview.empty')}</p>

      <NewSetsPrompt codes={overview.unknownSets} onAnswer={answer} />

      {overview.sources.length > 0 && (
        <table className="cardDatabase-sourceTable">
          <caption>{t('CardDatabaseOverview.sources')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('CardDatabaseOverview.column.file')}</th>
              <th scope="col">{t('CardDatabaseOverview.column.kind')}</th>
              <th scope="col">{t('CardDatabaseOverview.column.origin')}</th>
              <th scope="col">{t('CardDatabaseOverview.column.contents')}</th>
              <th scope="col">{t('CardDatabaseOverview.column.imported')}</th>
              <th scope="col" aria-label={t('CardDatabaseOverview.button.remove')} />
            </tr>
          </thead>
          <tbody>
            {overview.sources.map((source) => (
              <tr key={source.id}>
                <td>
                  {source.fileName}
                  {source.sourceVersion && (
                    <div className="cardDatabase-muted">{t('CardDatabaseOverview.version', { version: source.sourceVersion })}</div>
                  )}
                </td>
                <td>{t(`CardDatabaseOverview.kind.${source.kind}`)}</td>
                <td title={source.url}>{t(`CardDatabaseOverview.origin.${source.origin}`)}</td>
                <td>{t('CardDatabaseOverview.contents', { ...source.counts })}</td>
                <td>{formatDate(source.importedAt)}</td>
                <td>
                  {REMOVABLE.includes(source.kind) && (
                    <Button
                      size="small"
                      color="error"
                      disabled={disabled}
                      aria-label={`${t('CardDatabaseOverview.button.remove')} ${source.fileName}`}
                      onClick={() => overview.removeSource(source.id)}
                    >
                      {t('CardDatabaseOverview.button.remove')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="cardDatabase-actions">
        <Button disabled={disabled || overview.sources.length === 0} onClick={overview.reload}>
          {t('CardDatabaseOverview.button.reload')}
        </Button>
        <Button disabled={disabled} onClick={() => fileInput.current?.click()}>
          {t('CardDatabaseOverview.button.addCustom')}
        </Button>
        <input ref={fileInput} type="file" accept=".xml" multiple hidden onChange={onFiles} data-testid="custom-set-input" />
      </div>
      <div className="cardDatabase-actions">
        <Button disabled={disabled} onClick={overview.checkCardDatabase}>{t('CardDatabaseOverview.button.checkCards')}</Button>
        <Button disabled={disabled} onClick={overview.updateTokens}>{t('CardDatabaseOverview.button.updateTokens')}</Button>
        <Button disabled={disabled} onClick={overview.updateSpoilers}>{t('CardDatabaseOverview.button.updateSpoilers')}</Button>
        {overview.busy && <CircularProgress size={20} />}
      </div>
      {overview.lastUpdateCheck && (
        <div className="cardDatabase-muted">
          {t('CardDatabaseOverview.lastCheck', { date: formatDate(overview.lastUpdateCheck) })}
        </div>
      )}

      {overview.message && (
        <Alert severity={overview.message.severity} role="status">
          {'text' in overview.message
            ? overview.message.text
            : t(`CardDatabaseOverview.message.${overview.message.key}`, overview.message.params)}
        </Alert>
      )}
    </div>
  );
};

export default CardDatabaseOverview;
