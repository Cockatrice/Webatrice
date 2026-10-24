import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useCardOverride, useCommandFailureMessage, useReduxEffect } from '@app/hooks';
import { preferredPrinting } from '@app/services';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Response_CardArtRuleEntry } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';

import { loadCardPrintings, type CardPrinting } from './cardPrintings';

export const CARD_ART_RULE_MODES = ['ALLOW', 'DENY'] as const;
export type CardArtRuleMode = typeof CARD_ART_RULE_MODES[number];

export interface NewCardArtRule {
  cardName: string;
  cardProviderId: string;
  mode: CardArtRuleMode;
  reason: string;
}

export interface CardArtRules {
  error: string | null;
  dismissError: () => void;
  rules: Response_CardArtRuleEntry[];
  selectedIndex: number | null;
  select: (index: number) => void;
  printings: CardPrinting[];
  defaultProviderId: string;
  printingsPending: boolean;
  lookUpPrintings: (cardName: string) => void;
  addRule: (rule: NewCardArtRule) => void;
  removeSelected: () => void;
  refresh: () => void;
}

const FAILURE_KEYS: Partial<Record<WebsocketTypes.ModeratorCommandName, string>> = {
  listCardArtRules: 'CardArtRules.error.list',
  addCardArtRule: 'CardArtRules.error.add',
  removeCardArtRule: 'CardArtRules.error.remove',
};

const NO_RULES: Response_CardArtRuleEntry[] = [];

export function useCardArtRules(): CardArtRules {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const [error, setError] = useState<string | null>(null);
  useReduxEffect<{ command: WebsocketTypes.ModeratorCommandName; failure?: WebsocketTypes.CommandFailure }>(({ payload }) => {
    const key = FAILURE_KEYS[payload.command];
    if (key) {
      setError(describeFailure(payload.failure, t(key)));
    }
  }, server.Types.MODERATOR_COMMAND_FAILED, [t, describeFailure]);
  const rules = useAppSelector(server.Selectors.getCardArtRules) ?? NO_RULES;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [printings, setPrintings] = useState<CardPrinting[]>([]);
  const [printingCardName, setPrintingCardName] = useState('');
  const { pinnedPrintingId } = useCardOverride(printingCardName);
  const [printingsPending, setPrintingsPending] = useState(false);
  const lookup = useRef({ cardName: '', ready: false, sequence: 0 });
  useEffect(() => () => {
    lookup.current.sequence++;
  }, []);

  const refresh = useCallback(() => {
    setError(null);
    setSelectedIndex(null);
    webClient.request.moderator.listCardArtRules();
  }, [webClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lookUpPrintings = (value: string) => {
    const cardName = value.trim();
    if (lookup.current.cardName === cardName) {
      return;
    }
    const sequence = lookup.current.sequence + 1;
    lookup.current = { cardName, ready: false, sequence };
    setPrintingCardName(cardName);
    setPrintingsPending(true);
    const finish = (next: CardPrinting[]) => {
      if (lookup.current.sequence !== sequence) {
        return;
      }
      lookup.current.ready = true;
      setPrintings(next);
      setPrintingsPending(false);
    };
    loadCardPrintings(cardName).then(finish, () => finish([]));
  };

  const addRule = ({ cardName, cardProviderId, mode, reason }: NewCardArtRule) => {
    if (!lookup.current.ready || lookup.current.cardName !== cardName) {
      return;
    }
    webClient.request.moderator.addCardArtRule(cardName, cardProviderId, mode, reason);
    refresh();
  };

  const removeSelected = () => {
    const entry = selectedIndex === null ? undefined : rules[selectedIndex];
    if (!entry) {
      return;
    }
    webClient.request.moderator.removeCardArtRule(entry.cardName, entry.cardProviderId);
    refresh();
  };

  return {
    error,
    dismissError: () => setError(null),
    rules,
    selectedIndex,
    select: setSelectedIndex,
    printings,
    defaultProviderId: preferredPrinting({
      pinnedPrintingId,
      printings: printings.map((printing) => ({ scryfallId: printing.providerId })),
    })?.scryfallId ?? '',
    printingsPending,
    lookUpPrintings,
    addRule,
    removeSelected,
    refresh,
  };
}
