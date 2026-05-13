import { DragEvent, KeyboardEvent, ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { VirtualList } from '@app/components';
import { Card, Format, Set, Token } from '@app/types';
import { useCardImportForm } from './useCardImportForm';

import './CardImportForm.css';

interface CardImportFormProps {
  onSubmit: () => void;
}

interface BackButtonProps {
  click: () => void;
  disabled?: boolean;
}

const BackButton = ({ click, disabled }: BackButtonProps) => {
  const { t } = useTranslation();
  return (
    <Button onClick={click} disabled={disabled}>{t('CardImportForm.button.goBack')}</Button>
  );
};

interface ErrorMessageProps {
  error: string | null;
}

const ErrorMessage = ({ error }: ErrorMessageProps): ReactNode => (
  error ? <div className='error'>{error}</div> : null
);

interface CardsImportedProps {
  cards: Card[];
  sets: Set[];
  tokens?: Token[];
  formats?: Format[];
  acceptedFiles?: string[];
  skippedFiles?: string[];
}

const CardsImported = ({ cards, sets, tokens, formats, acceptedFiles, skippedFiles }: CardsImportedProps) => {
  const { t } = useTranslation();
  const items: ReactNode[] = [
    (
      <div key='import-summary'>
        <strong>{t('CardImportForm.message.importSummary', {
          cards: cards.length,
          sets: sets.length,
          tokens: tokens?.length ?? 0,
          formats: formats?.length ?? 0,
        })}</strong>
      </div>
    ),
    (<div key='spacer' className='spacer' />),
    ...sets.map(set => (
      <div key={set.name?.value ?? set.longname?.value}>
        {set.longname?.value ?? set.name?.value}
      </div>
    )),
  ];

  return (
    <div>
      <div className='card-import-list'>
        <VirtualList items={items} size={15} />
      </div>
      {(acceptedFiles?.length || skippedFiles?.length) ? (
        <div className='cardImportForm-fileList'>
          {acceptedFiles?.length ? (
            <div>
              {t('CardImportForm.message.acceptedFiles', { files: acceptedFiles.join(', ') })}
            </div>
          ) : null}
          {skippedFiles?.length ? (
            <div className='skipped'>
              {t('CardImportForm.message.skippedFiles', { files: skippedFiles.join(', ') })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const DropZone = ({ onFiles, disabled }: DropZoneProps) => {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(false);
    if (disabled) {
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      onFiles(files);
    }
  };

  const onBrowseClick = () => {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onBrowseClick();
    }
  };

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      onFiles(files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={`cardImportForm-dropzone${active ? ' is-active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowseClick}
      onKeyDown={onKeyDown}
      role='button'
      tabIndex={0}
    >
      <div>{t('CardImportForm.message.dropzone')}</div>
      <Button variant='outlined' size='small' onClick={(e) => {
        e.stopPropagation(); onBrowseClick();
      }} disabled={disabled} sx={{ mt: 1 }}>
        {t('CardImportForm.button.browseFiles')}
      </Button>
      <input
        ref={inputRef}
        type='file'
        accept='.xml'
        multiple
        onChange={onPickerChange}
      />
      <div className='cardImportForm-help'>
        <div>{t('CardImportForm.message.oracleHelp')}</div>
        <div><strong>Windows:</strong> <code>%APPDATA%\Cockatrice\</code></div>
        <div><strong>macOS:</strong> <code>~/Library/Application Support/Cockatrice/</code></div>
        <div><strong>Linux:</strong> <code>~/.local/share/Cockatrice/</code></div>
      </div>
    </div>
  );
};

const CardImportForm = ({ onSubmit: onClose }: CardImportFormProps) => {
  const { t } = useTranslation();
  const {
    loading,
    activeStep,
    steps,
    importedCards,
    importedSets,
    ingest,
    error,
    handleBack,
    handleLocalFiles,
    handleLocalSave,
  } = useCardImportForm();

  const renderLocalImport = (): ReactNode => (
    <div className='cardImportForm'>
      <div className='cardImportForm-content'>
        <DropZone onFiles={handleLocalFiles} disabled={loading} />
      </div>
      <div className='cardImportForm-error'>
        <ErrorMessage error={error} />
      </div>
    </div>
  );

  const renderLocalReview = (): ReactNode => (
    <div className='cardImportForm'>
      <div className='cardImportForm-content'>
        <CardsImported
          cards={importedCards}
          sets={importedSets}
          tokens={ingest?.tokens}
          formats={ingest?.formats}
          acceptedFiles={ingest?.acceptedFiles}
          skippedFiles={ingest?.skippedFiles}
        />
      </div>
      <div className='cardImportForm-actions'>
        <BackButton click={handleBack} disabled={loading} />
        <Button color='primary' onClick={handleLocalSave} disabled={loading}>
          {t('CardImportForm.button.save')}
        </Button>
      </div>
      <div className='cardImportForm-error'>
        <ErrorMessage error={error} />
      </div>
    </div>
  );

  const renderFinished = (): ReactNode => (
    <div className='cardImportForm'>
      <div className='cardImportForm-content done'>{t('CardImportForm.message.finished')}</div>
      <div className='cardImportForm-actions'>
        <Button color='primary' onClick={onClose}>{t('CardImportForm.button.done')}</Button>
      </div>
    </div>
  );

  const getStepContent = (stepIndex: number): ReactNode => {
    const stepKey = steps[stepIndex]?.key;
    switch (stepKey) {
      case 'importFiles': return renderLocalImport();
      case 'reviewAndSave': return renderLocalReview();
      case 'finished': return renderFinished();
      default:
        throw new Error(`CardImportForm: unknown step key ${stepKey} at index ${stepIndex}`);
    }
  };

  return (
    <div>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map(({ key, label }) => (
          <Step key={key}>
            <StepLabel>{t(label)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <div>
        {getStepContent(activeStep)}
      </div>

      {loading && (
        <div className='loading'>
          <CircularProgress size={60} />
        </div>
      )}
    </div>
  );
};

export default CardImportForm;
