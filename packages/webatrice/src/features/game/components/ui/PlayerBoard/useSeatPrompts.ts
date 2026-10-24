import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import {
  annotationPrompt,
  cardCounterPrompt,
  expressionPrompt,
  libraryCountPrompt,
  moveXFromTopPrompt,
  powerToughnessPrompt,
  tokenCountPrompt,
} from '../../../hooks/dialogs/seatPrompts';
import { applyPTSet } from '../../context-menus/CardContextMenu/cardAttributeEdits';
import { useGameDialogsContext } from '../GameDialogsContext';
import type {
  BattlefieldCardViewModel,
  CreateTokenRequest,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerZoneCommands,
} from './playerBoard.types';
import { toRecipient } from './revealRecipient';
import type { SeatCardMeta } from './useSeatCardMetadata';

const COUNTER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface PromptTargets {
  targetIds: number[];
  cardName: string;
  current: string;
}

export interface LifeControl {
  value: number;
  onDelta: (delta: number) => void;
  onSet: (value: number) => void;
}

export interface UseSeatPromptsArgs {
  seatId: number;
  lifeControl: LifeControl | undefined;
  battlefieldCards: readonly BattlefieldCardViewModel[];
  cardMetaByName: ReadonlyMap<string, SeatCardMeta>;
  draw: (n: number) => void;
  zoneCommands: PlayerZoneCommands;
  cardCommands: PlayerCardCommands;
  counterCommands: PlayerCounterCommands;
}

export function useSeatPrompts({
  seatId,
  lifeControl,
  battlefieldCards: battlefieldDisplayList,
  cardMetaByName,
  draw,
  zoneCommands,
  cardCommands,
  counterCommands,
}: UseSeatPromptsArgs) {
  const { t } = useTranslation();
  const { openZoneView, openPrompt, openCreateToken } = useGameDialogsContext();

  // Life total — starts at Commander 40. Only mutable by the owning
  // player; opponents render the number read-only. Capped at 9999 so
  // the number can't overflow the display box or (more importantly)
  // push the info column into an obviously silly state.
  const LIFE_MAX = 9999;
  // Fallback local life state — only used when no `lifeControl` prop
  // is passed (transient pre-hydration or when the player's life
  // counter hasn't landed in Redux yet).
  const [localLife, setLocalLifeState] = useState(40);
  const life = lifeControl ? lifeControl.value : localLife;
  const setLife = (next: number | ((prev: number) => number)) => {
    if (lifeControl) {
      // Controlled: compute the target value + delta and dispatch.
      // Callers that pass a plain number → `onSet`; callers that pass
      // a `(prev) => next` function get their delta forwarded via
      // `onDelta` so downstream selectors can decide whether to emit
      // an inc- or set-counter command (usually inc for the ±1 hover
      // paths, set for the edit-mode input).
      if (typeof next === 'function') {
        const target = Math.min(LIFE_MAX, Math.trunc(next(life)));
        lifeControl.onDelta(target - life);
      } else {
        lifeControl.onSet(Math.min(LIFE_MAX, Math.trunc(next)));
      }
      return;
    }
    setLocalLifeState((prev) => {
      const raw = typeof next === 'function' ? next(prev) : next;
      return Math.min(LIFE_MAX, Math.trunc(raw));
    });
  };
  const openLifePrompt = () => openPrompt(expressionPrompt(t, { current: life, onSubmit: (value) => setLife(value) }));
  const openCounterPrompt = ({ counterId, label, currentValue }: {
    counterId: number;
    label: string;
    currentValue: number;
  }) => openPrompt(expressionPrompt(t, {
    current: currentValue,
    title: t('GamePrompt.playerCounter.title'),
    label,
    description: t('GamePrompt.playerCounter.current', { count: currentValue }),
    onSubmit: (value) => counterCommands.set(counterId, Math.max(0, value)),
  }));
  const ptBaseRef = useRef({ battlefieldDisplayList, cardMetaByName });
  ptBaseRef.current = { battlefieldDisplayList, cardMetaByName };
  const openAnnotationPrompt = useCallback(({ targetIds, cardName, current }: PromptTargets) =>
    openPrompt(annotationPrompt(t, {
      cardName,
      current,
      onSubmit: (value) => {
        for (const id of targetIds) {
          cardCommands.setAnnotation(id, value);
        }
      },
    })), [openPrompt, cardCommands, t]);
  const openPTPrompt = useCallback(({ targetIds, cardName, current }: PromptTargets) =>
    openPrompt(powerToughnessPrompt(t, {
      cardName,
      current,
      onSubmit: (value) => {
        const { battlefieldDisplayList: board, cardMetaByName: meta } = ptBaseRef.current;
        const entries = targetIds.map((id) => {
          const bc = board.find((x) => Number(x.id) === id);
          const base = bc?.pt || (bc ? meta.get(bc.name)?.pt ?? '' : '');
          return { cardId: id, pt: applyPTSet(base, value) };
        });
        if (entries.length > 0) {
          cardCommands.setPT(entries);
        }
      },
    })), [openPrompt, cardCommands, t]);
  const openMoveXFromTopPrompt = useCallback(({ cardIds, cardName, deckSize, fromZone = ZoneName.TABLE }: {
    cardIds: number[];
    cardName: string;
    deckSize: number;
    fromZone?: string;
  }) =>
    openPrompt(moveXFromTopPrompt(t, {
      cardName,
      deckSize,
      initial: 0,
      onSubmit: (position) => zoneCommands.moveCards(fromZone, cardIds, { zone: ZoneName.DECK, index: position, reversed: false }),
    })), [openPrompt, zoneCommands, t]);
  const countDefault = (deckSize: number) => Math.min(3, Math.max(1, deckSize));
  const openCountPrompt = ({ title, submitLabel, deckSize, onSubmit }: {
    title: string;
    submitLabel: string;
    deckSize: number;
    onSubmit: (n: number) => void;
  }) => openPrompt(libraryCountPrompt(t, { title, submitLabel, deckSize, initial: countDefault(deckSize), onSubmit }));
  const openDrawCardsPrompt = ({ deckSize }: { deckSize: number }) =>
    openPrompt(libraryCountPrompt(t, {
      title: t('GamePrompt.draw.cardsTitle'),
      submitLabel: t('ZoneMenu.actionDraw'),
      deckSize,
      initial: 1,
      onSubmit: (n) => draw(n),
    }));
  const openViewLibraryCountPrompt = ({ isReversed, deckSize }: { isReversed: boolean; deckSize: number }) =>
    openCountPrompt({
      title: isReversed ? t('GamePrompt.view.bottomLibrary') : t('GamePrompt.view.topLibrary'),
      submitLabel: t('GamePrompt.view.action'),
      deckSize,
      onSubmit: (n) => openZoneView({ playerId: seatId, zoneName: ZoneName.DECK, numberCards: n, isReversed }),
    });
  const openRevealTopCardsPrompt = ({ targetPlayerId, deckSize }: {
    targetPlayerId: number;
    deckSize: number;
  }) => openCountPrompt({
    title: t('GamePrompt.view.revealTop'),
    submitLabel: t('GamePrompt.view.action'),
    deckSize,
    onSubmit: (n) => zoneCommands.reveal(ZoneName.DECK, toRecipient(targetPlayerId), { top: n }),
  });

  const openCardCounterPrompt = useCallback(({ targetIds, cardName, counterId, currentValue }: {
    targetIds: number[];
    cardName: string;
    counterId: number;
    currentValue: number;
  }) => openPrompt(cardCounterPrompt(t, {
    cardName,
    counterLetter: COUNTER_LETTERS[counterId] ?? String(counterId),
    current: currentValue,
    onSubmit: (value) => {
      counterCommands.setCardCounters(targetIds.map((id) => ({ cardId: id, counterId, value: Math.max(0, value) })));
    },
  })), [openPrompt, counterCommands, t]);
  // Last successfully-submitted token — powers "Create another token"
  // (Cockatrice's actCreateAnotherToken, player_actions.cpp:894-916).
  // Persisted across the dialog's open/close cycle so a subsequent
  // right-click → "Create another token" re-fires with the same args.
  const [lastToken, setLastToken] = useState<{
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  } | null>(null);
  const openTokenCountPrompt = useCallback(({ request, initial }: { request: CreateTokenRequest; initial: number }) =>
    openPrompt(tokenCountPrompt(t, {
      tokenName: request.name,
      initial,
      onSubmit: (count) => {
        for (let i = 0; i < count; i++) {
          cardCommands.createToken(request);
        }
      },
    })), [openPrompt, cardCommands, t]);
  const openCreateTokenDialog = () => openCreateToken({
    initial: lastToken,
    onSubmit: (token) => {
      setLastToken(token);
      cardCommands.createToken(token);
    },
  });

  return {
    life,
    setLife,
    openLifePrompt,
    openCounterPrompt,
    openAnnotationPrompt,
    openPTPrompt,
    openMoveXFromTopPrompt,
    openCountPrompt,
    openDrawCardsPrompt,
    openViewLibraryCountPrompt,
    openRevealTopCardsPrompt,
    openCardCounterPrompt,
    openTokenCountPrompt,
    lastToken,
    setLastToken,
    openCreateTokenDialog,
  };
}
