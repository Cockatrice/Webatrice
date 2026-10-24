import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCardOverride, usePreference } from '@app/hooks';
import { TokenDTO, dexieService } from '@app/services';

import type { CreateTokenSubmit } from './CreateTokenDialog';

export type ChooserScope = 'all' | 'deck';

export interface CreateTokenDialogState {
  name: string;
  color: string;
  pt: string;
  annotation: string;
  destroyOnZoneChange: boolean;
  faceDown: boolean;
  error: string | null;

  scope: ChooserScope;
  search: string;
  availableTokens: TokenDTO[];
  filteredTokens: TokenDTO[];
  selectedTokenName: string | null;

  setScope: (value: ChooserScope) => void;
  setSearch: (value: string) => void;
  selectPredefinedToken: (token: TokenDTO) => void;

  handleNameChange: (value: string) => void;
  setColor: (value: string) => void;
  setPT: (value: string) => void;
  setAnnotation: (value: string) => void;
  setDestroyOnZoneChange: (value: boolean) => void;
  setFaceDown: (value: boolean) => void;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
}

export const CREATE_TOKEN_DEFAULT_COLOR = 'w';

// Desktop server-side MAX_NAME_LENGTH is 0xff (255). Client-side caps on
// the other free-text fields mirror that to prevent oversize-payload
// round-trips that the server would reject anyway.
export const MAX_NAME_LEN = 255;
export const MAX_PT_LEN = 255;
export const MAX_ANNOTATION_LEN = 255;

export interface UseCreateTokenDialogArgs {
  isOpen: boolean;
  onSubmit: (args: CreateTokenSubmit) => void;
  initial?: CreateTokenSubmit | null;
  predefinedTokenNames?: string[];
}

function colorFromToken(token: TokenDTO): string {
  const raw = token.prop?.value?.colors?.value ?? '';
  if (!raw) {
    return '';
  }
  const colors = raw.toLowerCase().split('').filter((c) => 'wubrgm'.includes(c));
  if (colors.length === 0) {
    return '';
  }
  if (colors.length > 1) {
    return 'm';
  }
  const first = colors[0];
  if (first === 'm') {
    return 'm';
  }
  if (first === 'w' || first === 'u' || first === 'b' || first === 'r' || first === 'g') {
    return first;
  }
  return '';
}

export function useCreateTokenDialog({
  isOpen,
  onSubmit,
  initial,
  predefinedTokenNames,
}: UseCreateTokenDialogArgs): CreateTokenDialogState {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const { pinnedPrintingId } = useCardOverride(name.trim());
  const [color, setColor] = useState(CREATE_TOKEN_DEFAULT_COLOR);
  const [pt, setPT] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [destroyOnZoneChange, setDestroyOnZoneChange] = useState(true);
  const [faceDown, setFaceDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<ChooserScope>(predefinedTokenNames?.length ? 'deck' : 'all');
  const [search, setSearch] = useState('');
  const [availableTokens, setAvailableTokens] = useState<TokenDTO[]>([]);
  const [selectedTokenName, setSelectedTokenName] = useState<string | null>(null);
  const annotateTokens = usePreference('annotateTokens');

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? CREATE_TOKEN_DEFAULT_COLOR);
      setPT(initial?.pt ?? '');
      setAnnotation(initial?.annotation ?? '');
      setDestroyOnZoneChange(initial?.destroyOnZoneChange ?? true);
      setFaceDown(initial?.faceDown ?? false);
      setError(null);
      setSearch('');
      setSelectedTokenName(null);
      setScope(predefinedTokenNames?.length ? 'deck' : 'all');
    }
  }, [isOpen, initial, predefinedTokenNames]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    dexieService.tokens.toArray().then((tokens: TokenDTO[]) => {
      if (!cancelled) {
        setAvailableTokens(tokens);
      }
    }).catch(() => {
      if (!cancelled) {
        setAvailableTokens([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filteredTokens = useMemo(() => {
    const allowByScope = scope === 'deck' && predefinedTokenNames?.length
      ? new Set(predefinedTokenNames.map((n) => n.toLowerCase()))
      : null;
    const needle = search.trim().toLowerCase();
    return availableTokens.filter((token) => {
      const tokenName = token.name?.value ?? '';
      if (allowByScope && !allowByScope.has(tokenName.toLowerCase())) {
        return false;
      }
      if (needle && !tokenName.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [availableTokens, scope, search, predefinedTokenNames]);

  const handleNameChange = (value: string) => {
    setName(value.slice(0, MAX_NAME_LEN));
    if (error) {
      setError(null);
    }
  };

  const selectPredefinedToken = (token: TokenDTO) => {
    const tokenName = token.name?.value ?? '';
    setSelectedTokenName(tokenName);
    setName(tokenName.slice(0, MAX_NAME_LEN));
    setColor(colorFromToken(token));
    const ptRaw = token.prop?.value?.pt?.value ?? '';
    setPT(ptRaw.slice(0, MAX_PT_LEN));
    if (annotateTokens) {
      setAnnotation((token.text?.value ?? '').slice(0, MAX_ANNOTATION_LEN));
    }
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (name.trim().length === 0) {
      setError(t('CreateTokenDialog.validation.nameRequired'));
      return;
    }
    const payload: CreateTokenSubmit = {
      name: name.trim(),
      color,
      pt: pt.trim(),
      annotation: annotation.trim(),
      destroyOnZoneChange,
      faceDown,
    };
    payload.providerId = pinnedPrintingId ?? '';
    onSubmit(payload);
  };

  return {
    name,
    color,
    pt,
    annotation,
    destroyOnZoneChange,
    faceDown,
    error,
    scope,
    search,
    availableTokens,
    filteredTokens,
    selectedTokenName,
    setScope,
    setSearch,
    selectPredefinedToken,
    handleNameChange,
    setColor,
    setPT,
    setAnnotation,
    setDestroyOnZoneChange,
    setFaceDown,
    handleSubmit,
  };
}
