import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useImportSummaryText, useUnloadRisk, type ImportSummaryText } from '@app/hooks';
import {
  cardDatabaseService,
  saveCardSourceScan,
  scanCardSourceFiles,
  type CardSourceFileKind,
  type CardSourceScan,
  type UnknownSetsAnswer,
} from '@app/services';

export interface CardImportReview {
  cards: number;
  sets: number;
  tokens: number;
  formats: number;
  setNames: string[];
  files: { name: string; kind: CardSourceFileKind }[];
  problems: string[];
}

export interface CardImportResult {
  text: ImportSummaryText;
  unknownSets: string[];
}

export interface CardImportForm {
  answerUnknownSets: (answer: UnknownSetsAnswer) => Promise<void>;
  loading: boolean;
  activeStep: number;
  steps: { key: string; label: string }[];
  review: CardImportReview | null;
  result: CardImportResult | null;
  error: string | null;
  handleBack: () => void;
  handleLocalFiles: (files: File[]) => Promise<void>;
  handleLocalSave: () => Promise<void>;
}

const STEP_KEYS = ['importFiles', 'reviewAndSave', 'finished'] as const;

function reviewOf(scan: CardSourceScan, problems: string[]): CardImportReview {
  const records = scan.sources.map((source) => source.records);
  return {
    cards: records.reduce((total, r) => total + r.cards.length, 0),
    sets: records.reduce((total, r) => total + r.sets.length, 0),
    tokens: records.reduce((total, r) => total + r.tokens.length, 0),
    formats: records.reduce((total, r) => total + r.formats.length, 0),
    setNames: records.flatMap((r) => r.sets.map((set) => set.longname?.value ?? set.name.value)),
    files: scan.sources.map(({ name, kind }) => ({ name, kind })),
    problems,
  };
}

export function useCardImportForm(): CardImportForm {
  const { t } = useTranslation();
  const summaryText = useImportSummaryText();
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [scan, setScan] = useState<CardSourceScan | null>(null);
  const [review, setReview] = useState<CardImportReview | null>(null);
  const [result, setResult] = useState<CardImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useUnloadRisk(activeStep === 1);

  const steps = STEP_KEYS.map(key => ({ key, label: `CardImportForm.steps.${key}` }));

  const handleBack = () => {
    setError(null);
    setActiveStep(s => Math.max(0, s - 1));
  };

  const handleLocalFiles = async (files: File[]) => {
    setLoading(true);
    setError(null);
    try {
      const next = await scanCardSourceFiles(files);
      const { problems } = summaryText({ imported: [], skipped: next.skipped, failed: next.failed }, 'cardFiles');
      if (next.sources.length === 0) {
        setError([t('CardImportForm.message.noCardFiles'), ...problems].join(' '));
        return;
      }
      setScan(next);
      setReview(reviewOf(next, problems));
      setActiveStep(1);
    } catch (e) {
      console.error(e);
      setError(t('CardImportForm.message.readFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSave = async () => {
    if (!scan) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = await saveCardSourceScan(scan);
      setResult({ text: summaryText(summary, 'cardFiles'), unknownSets: summary.unknownSets });
      setActiveStep(2);
    } catch (e) {
      console.error(e);
      setError(t('CardImportForm.message.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    activeStep,
    steps,
    review,
    result,
    answerUnknownSets: async (answer) => {
      try {
        await cardDatabaseService.resolveUnknownSets(answer);
        setResult((current) => (current ? { ...current, unknownSets: [] } : current));
      } catch (e) {
        console.error(e);
        setError(t('CardImportForm.message.saveFailed'));
      }
    },
    error,
    handleBack,
    handleLocalFiles,
    handleLocalSave,
  };
}
