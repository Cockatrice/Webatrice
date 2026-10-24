import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';

import type { PlayerZoneCommands, SeatMoveCard, SeatMoveDestination } from './playerBoard.types';
import type { useSeatPrompts } from './useSeatPrompts';

type SeatPrompts = ReturnType<typeof useSeatPrompts>;

export interface UseLibraryOpsArgs {
  deckCount: number;
  openCountPrompt: SeatPrompts['openCountPrompt'];
  zoneCommands: PlayerZoneCommands;
}

export interface LibraryOps {
  moveTopCard(to: ZoneNameValue, index: SeatMoveDestination['index'], faceDown?: boolean): void;
  moveBottomCard(to: ZoneNameValue, index: SeatMoveDestination['index'], faceDown?: boolean): void;
  promptMoveTopCards(to: ZoneNameValue, faceDown?: boolean): void;
  promptMoveBottomCards(to: ZoneNameValue, faceDown?: boolean): void;
  promptShuffleTopCards(): void;
  promptShuffleBottomCards(): void;
}

export function libraryMovePrompt(
  t: TFunction,
  end: 'top' | 'bottom',
  to: ZoneNameValue,
): { title: string; submitLabel: string } {
  if (to === ZoneName.HAND) {
    return {
      title: end === 'top' ? t('ZoneMenu.promptDrawTop') : t('ZoneMenu.promptDrawBottom'),
      submitLabel: t('ZoneMenu.actionDraw'),
    };
  }
  const target = t(`ZoneLabel.title.${to}`);
  return {
    title: end === 'top' ? t('ZoneMenu.promptMoveTop', { target }) : t('ZoneMenu.promptMoveBottom', { target }),
    submitLabel: t('ZoneMenu.actionMove'),
  };
}

export function useLibraryOps({ deckCount, openCountPrompt, zoneCommands }: UseLibraryOpsArgs): LibraryOps {
  const { t } = useTranslation();
  return useMemo(() => {
    const card = (id: number, faceDown?: boolean): SeatMoveCard => (faceDown ? { id, faceDown: true } : id);
    const promptCount = (
      { title, submitLabel }: { title: string; submitLabel: string },
      onCount: (count: number, size: number) => void,
    ) => {
      const size = deckCount;
      if (size <= 0) {
        return;
      }
      openCountPrompt({
        title,
        submitLabel,
        deckSize: size,
        onSubmit: (n) => {
          const count = Math.min(n, size);
          if (count > 0) {
            onCount(count, size);
          }
        },
      });
    };

    return {
      moveTopCard: (to, index, faceDown) => {
        if (deckCount > 0) {
          zoneCommands.moveCards(ZoneName.DECK, [card(0, faceDown)], { zone: to, index });
        }
      },
      moveBottomCard: (to, index, faceDown) => {
        if (deckCount > 0) {
          zoneCommands.moveCards(ZoneName.DECK, [card(deckCount - 1, faceDown)], { zone: to, index });
        }
      },
      promptMoveTopCards: (to, faceDown) => promptCount(libraryMovePrompt(t, 'top', to), (count) => {
        const cards: SeatMoveCard[] = [];
        for (let i = count - 1; i >= 0; i--) {
          cards.push(card(i, faceDown));
        }
        zoneCommands.moveCards(ZoneName.DECK, cards, { zone: to });
      }),
      promptMoveBottomCards: (to, faceDown) => promptCount(libraryMovePrompt(t, 'bottom', to), (count, size) => {
        const cards: SeatMoveCard[] = [];
        for (let i = size - count; i < size; i++) {
          cards.push(card(i, faceDown));
        }
        zoneCommands.moveCards(ZoneName.DECK, cards, { zone: to });
      }),
      // Command_Shuffle's range is inclusive: [0, N-1] shuffles positions
      // 0..N-1 (player_actions.cpp:267-268).
      promptShuffleTopCards: () => promptCount(
        { title: t('ZoneMenu.promptShuffleTop'), submitLabel: t('ZoneMenu.actionShuffle') },
        (count) =>
          zoneCommands.shuffleLibrary({ start: 0, end: count - 1 })),
      promptShuffleBottomCards: () => promptCount(
        { title: t('ZoneMenu.promptShuffleBottom'), submitLabel: t('ZoneMenu.actionShuffle') },
        (count) =>
          zoneCommands.shuffleLibrary({ start: -count, end: -1 })),
    };
  }, [deckCount, openCountPrompt, t, zoneCommands]);
}
