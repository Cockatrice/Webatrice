import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { useUnloadRisk } from '@app/hooks';
import type { ParsedDeck } from '@app/types';

import {
  buildImportedDeckCod,
  countResolvedRows,
  resolveImportEntries,
  resolvedImportColorIdentity,
  summarizeImportRows,
  type ResolvedImportRow,
} from '../deckImport';
import { extraZoneSummary, isDeckFileName, listToParsedDeck, readDeckFile } from '../deckFiles';
import { parseDecklist } from '../decklistParser';

export type ImportPhase = 'input' | 'resolving' | 'review' | 'importing';

export type DeckImportHandler = (xml: string, colorIdentity: string) => boolean | void;

export interface DeckImportFlow {
  phase: ImportPhase;
  name: string;
  setName: (name: string) => void;
  format: string;
  setFormat: (format: string) => void;
  text: string;
  setText: (text: string) => void;
  error: string | null;
  resolved: ResolvedImportRow[];
  ignored: string[];
  matchedCount: number;
  missingCount: number;
  totalCount: number;
  extraZones: Array<{ zone: string; count: number }>;
  fileName: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pickFile: (file: File | null) => void;
  resolve: () => Promise<void>;
  backToInput: () => void;
  confirm: () => void;
}

export function useDeckImportFlow(open: boolean, onImport: DeckImportHandler, initialText = ''): DeckImportFlow {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [format, setFormatState] = useState('');
  const [formatTouched, setFormatTouched] = useState(false);
  const [text, setText] = useState(initialText);
  const [phase, setPhase] = useState<ImportPhase>('input');
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [resolved, setResolved] = useState<ResolvedImportRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useUnloadRisk(open && (text.trim() !== '' || phase !== 'input'));

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    generation.current += 1;
    setName('');
    setFormatState('');
    setFormatTouched(false);
    setText(initialText);
    setPhase('input');
    setDeck(null);
    setResolved([]);
    setIgnored([]);
    setError(null);
    setFileName(null);
    resetFileInput();
  }, [open, initialText]);

  const setFormat = (next: string) => {
    setFormatTouched(true);
    setFormatState(next);
  };

  const review = async (next: ParsedDeck, skipped: string[]) => {
    const run = ++generation.current;
    setPhase('resolving');
    setDeck(next);
    setIgnored(skipped);
    setName((current) => current.trim() ? current : next.name);
    if (!formatTouched) {
      setFormatState(next.format);
    }
    try {
      const rows = await resolveImportEntries(next.cards);
      if (run !== generation.current) {
        return;
      }
      setResolved(rows);
      setPhase('review');
    } catch (e) {
      if (run !== generation.current) {
        return;
      }
      setPhase('input');
      setError(e instanceof Error ? e.message : t('DeckImport.error.resolveFailed'));
    }
  };

  const pickFile = (picked: File | null) => {
    setError(null);
    resetFileInput();
    if (!picked) {
      return;
    }
    if (!isDeckFileName(picked.name)) {
      setError(t('DeckImport.error.notDeckFile', { name: picked.name }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const { deck: parsed, ignored: skipped } = readDeckFile(picked.name, content);
      if (parsed.cards.length === 0) {
        setError(t('DeckImport.error.noCardsInFile', { name: picked.name }));
        return;
      }
      setFileName(picked.name);
      void review(parsed, skipped);
    };
    reader.onerror = () => {
      setError(t('DeckImport.error.readFailed'));
    };
    reader.readAsText(picked);
  };

  const resolve = async () => {
    setError(null);
    const list = parseDecklist(text);
    if (list.entries.length === 0) {
      setError(t('DeckImport.error.noCards'));
      return;
    }
    setFileName(null);
    await review(listToParsedDeck(list, ''), list.ignored);
  };

  const backToInput = () => {
    generation.current += 1;
    setPhase('input');
    setFileName(null);
    setDeck(null);
  };

  const confirm = () => {
    if (!deck) {
      return;
    }
    setError(null);
    setPhase('importing');
    const sent = onImport(buildImportedDeckCod(deck, resolved, { name, format, t }), resolvedImportColorIdentity(resolved));
    if (sent === false) {
      setPhase('review');
      setError(t('DeckImport.error.notConnected'));
    }
  };

  const { matched, missing } = countResolvedRows(resolved);

  return {
    phase,
    name,
    setName,
    format,
    setFormat,
    text,
    setText,
    error,
    resolved,
    ignored,
    matchedCount: matched,
    missingCount: missing,
    totalCount: summarizeImportRows(resolved).total,
    extraZones: extraZoneSummary(deck?.extraZonesXml),
    fileName,
    fileInputRef,
    pickFile,
    resolve,
    backToInput,
    confirm,
  };
}
