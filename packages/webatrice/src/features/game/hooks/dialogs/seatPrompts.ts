
import { evalLifeExpression } from '../../components/right-sidebar/PlayerInfoPanel/lifeExpression';
import type { PromptState } from './gameDialogs.types';
import type { TFunction } from 'i18next';

const INTEGER = /^-?\d+$/;

function parseWhole(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export interface ExpressionPromptArgs {
  current: number;
  onSubmit: (value: number) => void;
  title?: string;
  label?: string;
  description?: string;
}

export function expressionPrompt(t: TFunction, { current, onSubmit, title, label, description }: ExpressionPromptArgs): PromptState {
  return {
    title: title ?? t('GamePrompt.life.title'),
    label: label ?? t('GamePrompt.life.label'),
    description: description ?? t('GamePrompt.life.description'),
    initialValue: String(current),
    submitLabel: t('GamePrompt.action.save'),
    inputMode: 'numeric',
    selectOnFocus: true,
    preview: (value) => {
      const result = evalLifeExpression(value);
      return result == null || INTEGER.test(value.trim()) ? null : `= ${result}`;
    },
    validate: (value) => (evalLifeExpression(value) == null ? t('GamePrompt.life.invalid') : null),
    onSubmit: (value) => onSubmit(evalLifeExpression(value)!),
  };
}

export interface CardTextPromptArgs {
  cardName: string;
  current: string;
  onSubmit: (value: string) => void;
}

export function powerToughnessPrompt(t: TFunction, { cardName, current, onSubmit }: CardTextPromptArgs): PromptState {
  return {
    title: t('GamePrompt.powerToughness.title'),
    label: t('GamePrompt.powerToughness.label'),
    description: cardName,
    initialValue: current,
    placeholder: t('GamePrompt.powerToughness.placeholder'),
    submitLabel: t('GamePrompt.action.save'),
    selectOnFocus: true,
    onSubmit,
  };
}

export function annotationPrompt(t: TFunction, { cardName, current, onSubmit }: CardTextPromptArgs): PromptState {
  return {
    title: t('GamePrompt.annotation.title'),
    label: t('GamePrompt.annotation.label'),
    description: cardName,
    initialValue: current,
    placeholder: t('GamePrompt.annotation.placeholder'),
    submitLabel: t('GamePrompt.action.save'),
    selectOnFocus: true,
    onSubmit,
  };
}

export interface CardCounterPromptArgs {
  cardName: string;
  counterLetter: string;
  current: number;
  onSubmit: (value: number) => void;
}

export function cardCounterPrompt(t: TFunction, { cardName, counterLetter, current, onSubmit }: CardCounterPromptArgs): PromptState {
  return {
    title: t('GamePrompt.counter.title', { counter: counterLetter }),
    label: t('GamePrompt.counter.label'),
    description: cardName,
    initialValue: String(current),
    submitLabel: t('GamePrompt.action.set'),
    type: 'number',
    selectOnFocus: true,
    validate: (value) => {
      const n = parseWhole(value);
      return n == null || n < 0 ? t('GamePrompt.validation.zeroOrMore') : null;
    },
    onSubmit: (value) => onSubmit(parseWhole(value)!),
  };
}

export interface LibraryCountPromptArgs {
  title: string;
  submitLabel: string;
  deckSize: number;
  initial: number;
  onSubmit: (count: number) => void;
}

export function libraryCountPrompt(t: TFunction, { title, submitLabel, deckSize, initial, onSubmit }: LibraryCountPromptArgs): PromptState {
  const size = Math.max(0, deckSize);
  return {
    title,
    label: t('GamePrompt.library.numberOfCards'),
    description: t('MoveTopUntilDialog.librarySize', { count: size }),
    initialValue: String(initial),
    submitLabel,
    type: 'number',
    selectOnFocus: true,
    validate: (value) => {
      if (size <= 0) {
        return t('GamePrompt.library.empty');
      }
      const n = parseWhole(value);
      return n == null || n < 1 ? t('GamePrompt.validation.oneOrMore') : null;
    },
    onSubmit: (value) => onSubmit(Math.min(parseWhole(value)!, size)),
  };
}

export interface MoveXFromTopPromptArgs {
  cardName: string;
  deckSize: number;
  initial: number;
  onSubmit: (position: number) => void;
}

export function moveXFromTopPrompt(t: TFunction, { cardName, deckSize, initial, onSubmit }: MoveXFromTopPromptArgs): PromptState {
  const size = Math.max(0, deckSize);
  const maximumPosition = size + 1;
  return {
    title: t('GamePrompt.library.moveFromTopTitle'),
    label: t('GamePrompt.library.position', { count: maximumPosition }),
    description: cardName,
    initialValue: String(initial + 1),
    submitLabel: t('ZoneMenu.actionMove'),
    type: 'number',
    selectOnFocus: true,
    validate: (value) => {
      const n = parseWhole(value);
      return n == null || n < 1 ? t('GamePrompt.validation.oneOrMore') : null;
    },
    onSubmit: (value) => onSubmit(Math.min(parseWhole(value)!, maximumPosition) - 1),
  };
}

export const MAX_TOKENS_PER_PROMPT = 99;

export interface TokenCountPromptArgs {
  tokenName: string;
  initial: number;
  onSubmit: (count: number) => void;
}

export function tokenCountPrompt(t: TFunction, { tokenName, initial, onSubmit }: TokenCountPromptArgs): PromptState {
  return {
    title: t('GamePrompt.token.title'),
    label: t('GamePrompt.token.label'),
    description: tokenName,
    initialValue: String(initial),
    submitLabel: t('GamePrompt.token.create'),
    type: 'number',
    selectOnFocus: true,
    validate: (value) => {
      const n = parseWhole(value);
      return n == null || n < 1 || n > MAX_TOKENS_PER_PROMPT ? t('GamePrompt.token.invalid', { max: MAX_TOKENS_PER_PROMPT }) : null;
    },
    onSubmit: (value) => onSubmit(parseWhole(value)!),
  };
}
