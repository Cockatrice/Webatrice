import { useEffect, useState } from 'react';

import { localOracleImportService, IngestResult } from './LocalOracleImportService';
import { Card, Set } from '@app/types';
export interface CardImportForm {
  loading: boolean;
  activeStep: number;
  steps: { key: string; label: string }[];
  importedCards: Card[];
  importedSets: Set[];
  ingest: IngestResult | null;
  error: string | null;
  handleBack: () => void;
  handleLocalFiles: (files: File[]) => Promise<void>;
  handleLocalSave: () => Promise<void>;
}

const STEP_KEYS = ['importFiles', 'reviewAndSave', 'finished'] as const;

export function useCardImportForm(): CardImportForm {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [importedCards, setImportedCards] = useState<Card[]>([]);
  const [importedSets, setImportedSets] = useState<Set[]>([]);
  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      setError(null);
    }
  }, [loading]);

  const steps = STEP_KEYS.map(key => ({ key, label: `CardImportForm.steps.${key}` }));

  const handleNext = () => setActiveStep(s => s + 1);
  const handleBack = () => {
    setError(null);
    setActiveStep(s => Math.max(0, s - 1));
  };

  const handleLocalFiles = async (files: File[]) => {
    setLoading(true);
    try {
      const result = await localOracleImportService.ingest(files);
      if (result.acceptedFiles.length === 0) {
        throw new Error('No recognized files. Expected cards.xml, tokens.xml, or spoiler.xml.');
      }
      setIngest(result);
      setImportedCards(result.cards);
      setImportedSets(result.sets);
      handleNext();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSave = async () => {
    if (!ingest) {
      return;
    }
    setLoading(true);
    try {
      await localOracleImportService.persist({
        cards: ingest.cards,
        sets: ingest.sets,
        tokens: ingest.tokens,
        formats: ingest.formats,
        info: ingest.info,
      });
      handleNext();
    } catch (e) {
      console.error(e);
      setError('Failed to save imported data');
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
}
