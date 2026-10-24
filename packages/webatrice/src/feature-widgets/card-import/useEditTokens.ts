import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cardDatabaseService,
  CUSTOM_TOKEN_SET,
  TokenNameConflictError,
  writeCockatriceXml,
  type Token,
} from '@app/services';

import { toCardDataError, type CardDataError } from './cardDataError';
import { applyTokenData, createCustomToken, type TokenData } from './customTokens';

export type AddTokenOutcome = 'added' | 'conflict';

export interface EditTokens {
  loading: boolean;
  error: CardDataError | null;
  tokens: Token[];
  selected: Token | null;
  select: (name: string | null) => void;
  addToken: (name: string) => Promise<AddTokenOutcome>;
  updateSelected: (data: TokenData) => Promise<void>;
  removeSelected: () => Promise<void>;
  exportXml: () => string;
}

const byName = (a: Token, b: Token) => a.name.value.localeCompare(b.name.value);

export function useEditTokens(): EditTokens {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CardDataError | null>(null);

  useEffect(() => {
    let cancelled = false;
    cardDatabaseService.getCustomTokens().then((loaded) => {
      if (!cancelled) {
        setTokens([...loaded].sort(byName));
        setLoading(false);
      }
    }).catch((e: Error) => {
      if (!cancelled) {
        setError(toCardDataError('load', e));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (changed: Token[], removed: string[] = [], mode: 'add' | 'update' | 'upsert' = 'upsert') => {
    setError(null);
    try {
      const saved = await cardDatabaseService.saveCustomTokens(changed, removed, mode);
      setTokens([...saved].sort(byName));
    } catch (e) {
      if (!(e instanceof TokenNameConflictError)) {
        setError(toCardDataError('save', e));
      }
      throw e;
    }
  }, []);

  const selected = useMemo(
    () => tokens.find((token) => token.name.value === selectedName) ?? null,
    [tokens, selectedName],
  );

  const addToken = async (rawName: string): Promise<AddTokenOutcome> => {
    if (loading) {
      throw new Error('Custom tokens are still loading');
    }
    const name = rawName.trim();
    const local = tokens.some((token) => token.name.value.toLowerCase() === name.toLowerCase());
    if (local || await cardDatabaseService.isNameTaken(name)) {
      return 'conflict';
    }
    try {
      await persist([createCustomToken(name)], [], 'add');
    } catch (e) {
      if (e instanceof TokenNameConflictError) {
        return 'conflict';
      }
      throw e;
    }
    setSelectedName(name);
    return 'added';
  };

  const updateSelected = async (data: TokenData) => {
    if (loading || !selected) {
      return;
    }
    await persist([applyTokenData(selected, data)], [], 'update');
  };

  const removeSelected = async () => {
    if (loading || !selected) {
      return;
    }
    const name = selected.name.value;
    setSelectedName(null);
    await persist([], [name]);
  };

  return {
    loading,
    error,
    tokens,
    selected,
    select: setSelectedName,
    addToken,
    updateSelected,
    removeSelected,
    exportXml: () => writeCockatriceXml({ sets: [CUSTOM_TOKEN_SET], cards: tokens }),
  };
}
