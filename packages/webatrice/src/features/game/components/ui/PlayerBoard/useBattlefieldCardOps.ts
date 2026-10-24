import { useMemo } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';
import { usePreference } from '@app/hooks';
import type { LookupResult } from '@app/services';

import type { SeatSelection, SeatSelectionApi } from '../../../hooks/useSeatSelection';
import { createAllRelated } from '../../context-menus/CardContextMenu/relatedCardActions';
import {
  cardIdsOf,
  cloneSource,
  counterStepEntries,
  counterValue,
  currentPT,
  incrementAllCounterEntries,
  ptDeltaEntries,
  resetPTEntries,
  resolveTargets,
  sameSlotIds,
  selectionOrAll,
  totalPower,
  type BattlefieldTargets,
} from './battlefieldSelectionOps';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerTargetCommands,
  PlayerZoneCommands,
  SeatMoveDestination,
} from './playerBoard.types';
import { moveSelectedCards } from './selectionMoves';
import type { SeatCardMeta } from './useSeatCardMetadata';
import type { LifeControl, useSeatPrompts } from './useSeatPrompts';

type SeatPrompts = ReturnType<typeof useSeatPrompts>;

export interface UseBattlefieldCardOpsArgs {
  cards: readonly BattlefieldCardViewModel[];
  selection: SeatSelection | null;
  setSelection: SeatSelectionApi['setSelection'];
  cardMetaByName: ReadonlyMap<string, SeatCardMeta>;
  tokenMetaByName: ReadonlyMap<string, LookupResult>;
  deckCount: number;
  lifeControl: LifeControl | undefined;
  cardCommands: PlayerCardCommands;
  counterCommands: PlayerCounterCommands;
  targetCommands: PlayerTargetCommands;
  zoneCommands: PlayerZoneCommands;
  prompts: Pick<
    SeatPrompts,
    'openAnnotationPrompt' | 'openPTPrompt' | 'openCardCounterPrompt' | 'openMoveXFromTopPrompt' | 'openTokenCountPrompt'
  >;
  setLastToken: SeatPrompts['setLastToken'];
  startAttach: (sourceCardIds: readonly number[], anchorName: string) => void;
  startArrow: (sourceCardId: number, sourceCardName: string) => void;
}

export interface BattlefieldCardOps {
  toggleTapped(): void;
  toggleFaceDown(): void;
  peek(): void;
  toggleDoesntUntap(): void;
  clone(): void;
  move(to: SeatMoveDestination): void;
  promptMoveXFromTop(): void;
  changePT(deltaP: number, deltaT: number): void;
  promptPT(): void;
  resetPT(): void;
  promptAnnotation(): void;
  attach(): void;
  drawArrow(): void;
  unattach(): void;
  reduceLifeByPower(): void;
  selectRow(): void;
  selectColumn(): void;
  stepCounter(counterId: number, step: 1 | -1): void;
  promptCounter(counterId: number): void;
  createRelatedTokens(): void;
}

export interface BattlefieldCardActions {
  forCard(cardId: string): BattlefieldCardOps | null;
  forSelection(): BattlefieldCardOps | null;
  selectAll(): void;
  incrementAllCounters(): void;
}

export function useBattlefieldCardOps({
  cards,
  selection,
  setSelection,
  cardMetaByName,
  tokenMetaByName,
  deckCount,
  lifeControl,
  cardCommands,
  counterCommands,
  targetCommands,
  zoneCommands,
  prompts,
  setLastToken,
  startAttach,
  startArrow,
}: UseBattlefieldCardOpsArgs): BattlefieldCardActions {
  const { openAnnotationPrompt, openPTPrompt, openCardCounterPrompt, openMoveXFromTopPrompt, openTokenCountPrompt } = prompts;
  const annotateTokens = usePreference('annotateTokens');

  return useMemo(() => {
    const printedPT = (name: string) => cardMetaByName.get(name)?.pt ?? '';
    const select = (ids: Set<string>) => {
      if (ids.size > 0) {
        setSelection({ zone: 'battlefield', ids });
      }
    };
    const setCounters = (entries: { cardId: number; counterId: number; value: number }[]) => {
      if (entries.length > 0) {
        counterCommands.setCardCounters(entries);
      }
    };

    const opsFor = (targets: BattlefieldTargets | null): BattlefieldCardOps | null => {
      if (!targets) {
        return null;
      }
      const { cards: targetCards, anchor } = targets;
      const targetIds = cardIdsOf(targetCards);
      const anchorId = Number(anchor.id);
      const anchorNumeric = Number.isFinite(anchorId);
      const each = (send: (cardId: number) => void) => targetIds.forEach(send);
      const setPT = (entries: { cardId: number; pt: string }[]) => {
        if (entries.length > 0) {
          cardCommands.setPT(entries);
        }
      };
      const prompt = (open: (promptTargets: { targetIds: number[]; cardName: string }) => void) => {
        if (targetIds.length > 0) {
          open({ targetIds, cardName: anchor.name });
        }
      };

      return {
        toggleTapped: () => {
          for (const tapped of [false, true]) {
            const ids = cardIdsOf(targetCards.filter((c) => Boolean(c.tapped) === tapped));
            if (ids.length > 0) {
              cardCommands.setTapped(ids, !tapped);
            }
          }
        },
        toggleFaceDown: () => each((id) => cardCommands.flip(id, !anchor.faceDown)),
        peek: () => {
          const faceDownIds = cardIdsOf(targetCards.filter((c) => c.faceDown));
          if (cardCommands.peek && faceDownIds.length > 0) {
            cardCommands.peek(faceDownIds);
          }
        },
        toggleDoesntUntap: () => each((id) => cardCommands.setDoesntUntap(id, !anchor.doesntUntap)),
        clone: () => targetCards.forEach((c) => {
          if (Number.isFinite(Number(c.id))) {
            cardCommands.clone(cloneSource(c));
          }
        }),
        move: (to) => moveSelectedCards(zoneCommands.moveCards, ZoneName.TABLE, targetCards, to, (name) => cardMetaByName.get(name)),
        promptMoveXFromTop: () => {
          if (anchorNumeric) {
            openMoveXFromTopPrompt({ cardIds: [anchorId], cardName: anchor.name, deckSize: deckCount });
          }
        },
        changePT: (deltaP, deltaT) => setPT(ptDeltaEntries(targetCards, printedPT, deltaP, deltaT)),
        promptPT: () => prompt((t) => openPTPrompt({ ...t, current: currentPT(anchor, printedPT) })),
        resetPT: () => setPT(resetPTEntries(targetCards, printedPT)),
        promptAnnotation: () => prompt((t) => openAnnotationPrompt({ ...t, current: anchor.annotation ?? '' })),
        attach: () => {
          const sourceIds = anchorNumeric ? [anchorId, ...targetIds.filter((id) => id !== anchorId)] : targetIds;
          if (sourceIds.length > 0) {
            const arrowCard = targetCards.find((c) => Number(c.id) === sourceIds[0]) ?? anchor;
            startAttach(sourceIds, arrowCard.name);
          }
        },
        drawArrow: () => {
          if (anchorNumeric) {
            startArrow(anchorId, anchor.name);
          }
        },
        unattach: () => each((id) => targetCommands.unattach(id)),
        reduceLifeByPower: () => {
          const total = totalPower(targetCards);
          if (total > 0) {
            lifeControl?.onDelta(-total);
          }
        },
        selectRow: () => select(sameSlotIds(cards, anchor, 'row')),
        selectColumn: () => select(sameSlotIds(cards, anchor, 'col')),
        stepCounter: (counterId, step) => setCounters(counterStepEntries(targetCards, counterId, step)),
        promptCounter: (counterId) =>
          prompt((t) => openCardCounterPrompt({ ...t, counterId, currentValue: counterValue(anchor, counterId) })),
        createRelatedTokens: () => {
          const meta = cardMetaByName.get(anchor.name);
          const { requests, prompt: countPrompt, lastToken } = createAllRelated({
            related: meta?.related ?? [],
            tokenMeta: tokenMetaByName,
            parentMeta: meta,
            sourceCardId: anchorNumeric ? anchorId : undefined,
            parentName: anchor.name,
            annotate: annotateTokens,
          });
          requests.forEach((request) => cardCommands.createToken(request));
          if (lastToken) {
            setLastToken(lastToken);
          }
          if (countPrompt) {
            openTokenCountPrompt({ request: countPrompt.request, initial: countPrompt.defaultCount });
          }
        },
      };
    };

    return {
      forCard: (cardId) => opsFor(resolveTargets(cards, selection, cardId)),
      forSelection: () => opsFor(resolveTargets(cards, selection)),
      selectAll: () => select(new Set(cards.map((c) => c.id))),
      incrementAllCounters: () => setCounters(incrementAllCounterEntries(selectionOrAll(cards, selection))),
    };
  }, [
    cards, selection, setSelection, cardMetaByName, tokenMetaByName, deckCount, lifeControl, cardCommands, counterCommands,
    targetCommands, zoneCommands, openAnnotationPrompt, openPTPrompt, openCardCounterPrompt, openMoveXFromTopPrompt,
    openTokenCountPrompt, setLastToken, startAttach, startArrow, annotateTokens,
  ]);
}
