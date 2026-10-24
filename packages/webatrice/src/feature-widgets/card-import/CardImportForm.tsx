import { DragEvent, ReactNode, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';



import Button from '@mui/material/Button';

import Stepper from '@mui/material/Stepper';

import Step from '@mui/material/Step';

import StepLabel from '@mui/material/StepLabel';

import CircularProgress from '@mui/material/CircularProgress';



import { VirtualList } from '@app/components';

import type { CardSourceFileKind } from '@app/services';

import NewSetsPrompt, { type NewSetsChoice } from './NewSetsPrompt';

import { useCardImportForm, type CardImportReview } from './useCardImportForm';



import './CardImportForm.css';



interface CardImportFormProps {

  onSubmit: () => void;

  onViewSets?: () => void;

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



const SOURCE_KIND_KEYS: Record<CardSourceFileKind, string> = {

  main: 'CardDatabaseOverview.kind.main',

  tokens: 'CardDatabaseOverview.kind.tokens',

  spoiler: 'CardDatabaseOverview.kind.spoiler',

  custom: 'CardDatabaseOverview.kind.custom',

  'user-tokens': 'CardDatabaseOverview.kind.user-tokens',

};



const OS_LABEL_KEYS = {

  windows: 'CardImportForm.os.windows',

  macos: 'CardImportForm.os.macos',

  linux: 'CardImportForm.os.linux',

} as const;



interface CardsImportedProps {

  review: CardImportReview;

}



const CardsImported = ({ review }: CardsImportedProps) => {

  const { t } = useTranslation();

  const items: ReactNode[] = [

    (

      <div key='import-summary'>

        <strong>{t('CardImportForm.message.importSummary', {

          cards: review.cards,

          sets: review.sets,

          tokens: review.tokens,

          formats: review.formats,

        })}</strong>

      </div>

    ),

    (<div key='spacer' className='spacer' />),

    ...review.setNames.map((name, index) => (

      <div key={`${index}:${name}`}>{name}</div>

    )),

  ];

  const files = review.files

    .map(({ name, kind }) => t('CardImportForm.message.fileKind', { name, kind: t(SOURCE_KIND_KEYS[kind]) }))

    .join(', ');



  return (

    <div>

      <div className='card-import-list'>

        <VirtualList items={items} size={15} />

      </div>

      <div className='cardImportForm-fileList'>

        <div>{t('CardImportForm.message.acceptedFiles', { files })}</div>

        {review.problems.map((problem) => (

          <div key={problem} className='skipped'>{problem}</div>

        ))}

      </div>

    </div>

  );

};



const DESKTOP_DATA_FOLDERS = [

  { os: 'windows', path: '%LOCALAPPDATA%\\Cockatrice\\Cockatrice' },

  { os: 'macos', path: '~/Library/Application Support/Cockatrice/Cockatrice' },

  { os: 'linux', path: '~/.local/share/Cockatrice/Cockatrice' },

] as const;



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

        {DESKTOP_DATA_FOLDERS.map(({ os, path }) => (

          <div key={os}><strong>{t(OS_LABEL_KEYS[os])}</strong> <code>{path}</code></div>

        ))}

        <div>{t('CardImportForm.message.customSetsHelp')}</div>

      </div>

    </div>

  );

};



const CardImportForm = ({ onSubmit: onClose, onViewSets }: CardImportFormProps) => {

  const { t } = useTranslation();

  const {

    loading,

    activeStep,

    steps,

    review,

    result,

    answerUnknownSets,

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

        {review && <CardsImported review={review} />}

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



  const answerNewSets = async (choice: NewSetsChoice) => {

    await answerUnknownSets(choice === 'view' ? 'keep-disabled' : choice);

    if (choice === 'view') {

      onViewSets?.();

    }

  };



  const renderFinished = (): ReactNode => (

    <div className='cardImportForm'>

      {result && (

        <div className='cardImportForm-content cardImportForm-summary' role='status'>

          <strong>{result.text.headline}</strong>

          {result.text.problems.map((problem) => (

            <div key={problem} className='problem'>{problem}</div>

          ))}

        </div>

      )}

      <NewSetsPrompt codes={result?.unknownSets ?? []} onAnswer={answerNewSets} />

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

