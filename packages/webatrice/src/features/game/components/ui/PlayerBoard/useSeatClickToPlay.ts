import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';
import { usePreference } from '@app/hooks';
import { lookupCard } from '@app/services';

import type { SeatSelection } from '../../../hooks/useSeatSelection';
import { playCardMove } from '../../context-menus/CardContextMenu/handCardMenu.actions';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCardViewModel,
  PlayerZoneCommands,
} from './playerBoard.types';
import { seatCardMetaFromLookup, type SeatCardMeta } from './useSeatCardMetadata';

export type ClickToPlayZone = 'hand' | 'stack' | 'battlefield';

export interface ClickModifiers {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

const NO_MODIFIERS: ClickModifiers = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

function isAltOnly({ shiftKey, altKey, ctrlKey, metaKey }: ClickModifiers): boolean {
  return altKey && !shiftKey && !ctrlKey && !metaKey;
}

interface UseSeatClickToPlayArgs {
  canAct: boolean;
  selection: SeatSelection | null;
  handDisplayList: readonly PlayerCardViewModel[];
  stackDisplayList: readonly PlayerCardViewModel[];
  battlefieldDisplayList: readonly BattlefieldCardViewModel[];
  cardMetaByName: ReadonlyMap<string, SeatCardMeta>;
  setCardMetaByName: Dispatch<SetStateAction<Map<string, SeatCardMeta>>>;
  zoneCommands: PlayerZoneCommands;
  cardCommands: PlayerCardCommands;
}

export function useSeatClickToPlay({
  canAct,
  selection,
  handDisplayList,
  stackDisplayList,
  battlefieldDisplayList,
  cardMetaByName,
  setCardMetaByName,
  zoneCommands,
  cardCommands,
}: UseSeatClickToPlayArgs) {
  const doubleClickToPlay = usePreference('doubleClickToPlay');
  const clickPlaysAllSelected = usePreference('clickPlaysAllSelected');
  const playToStack = usePreference('playToStack');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const metaOf = async (name: string): Promise<SeatCardMeta> => {
    const cached = cardMetaByName.get(name);
    if (cached?.tableRow != null || cached?.typeLine) {
      return cached;
    }
    const meta = seatCardMetaFromLookup(await lookupCard(name));
    if (meta.typeLine || meta.pt) {
      setCardMetaByName((prev) => {
        if (prev.get(name)?.typeLine) {
          return prev;
        }
        const next = new Map(prev);
        next.set(name, { ...prev.get(name), ...meta });
        return next;
      });
    }
    return { ...cached, ...meta };
  };

  const playCard = async (zone: 'hand' | 'stack', card: PlayerCardViewModel, faceDown: boolean) => {
    const cardId = Number(card.id);
    if (!Number.isFinite(cardId)) {
      return;
    }
    const from = zone === 'hand' ? ZoneName.HAND : ZoneName.STACK;
    const meta = faceDown ? undefined : await metaOf(card.name);
    if (!mounted.current) {
      return;
    }
    const play = playCardMove(cardId, meta, { faceDown, playToStack: zone === 'hand' && playToStack, fromStack: zone === 'stack' });
    zoneCommands.moveCards(from, [play.card], play.to);
  };

  const targetsOf = <T extends PlayerCardViewModel>(
    zone: ClickToPlayZone,
    card: T,
    zoneCards: readonly T[],
    selected: SeatSelection | null,
  ): T[] =>
      selected?.zone === zone && selected.ids.has(card.id)
        ? zoneCards.filter((c) => selected.ids.has(c.id))
        : [card];

  const toggleTapped = (card: BattlefieldCardViewModel, selected: SeatSelection | null) => {
    const targets = targetsOf('battlefield', card, battlefieldDisplayList, selected);
    const tapAll = targets.some((c) => !c.tapped);
    const ids = targets
      .filter((c) => c.tapped !== tapAll)
      .map((c) => Number(c.id))
      .filter(Number.isFinite);
    if (ids.length > 0) {
      cardCommands.setTapped(ids, tapAll);
    }
  };

  const clickToPlay = async (
    zone: ClickToPlayZone,
    card: PlayerCardViewModel,
    modifiers: ClickModifiers,
    selected: SeatSelection | null,
  ) => {
    if (!canAct || isAltOnly(modifiers)) {
      return;
    }
    if (zone === 'battlefield') {
      const onTable = battlefieldDisplayList.find((c) => c.id === card.id);
      if (onTable) {
        toggleTapped(onTable, selected);
      }
      return;
    }
    const zoneCards = zone === 'hand' ? handDisplayList : stackDisplayList;
    const targets = targetsOf(zone, card, zoneCards, clickPlaysAllSelected ? selected : null)
      .sort((a, b) => Number(b.id) - Number(a.id));
    for (const target of targets) {
      await playCard(zone, target, modifiers.shiftKey);
    }
  };

  return {
    doubleClickToPlay,
    onCardActivate: (zone: ClickToPlayZone, card: PlayerCardViewModel) => {
      void clickToPlay(zone, card, NO_MODIFIERS, selection);
    },
    onCardDoubleClick: (zone: ClickToPlayZone, card: PlayerCardViewModel, e: ClickModifiers) => {
      if (doubleClickToPlay) {
        void clickToPlay(zone, card, e, selection);
      }
    },
    onCardClick: (
      zone: ClickToPlayZone,
      card: PlayerCardViewModel,
      e: ClickModifiers,
      selectionBefore: SeatSelection | null,
    ) => {
      if (!doubleClickToPlay) {
        void clickToPlay(zone, card, e, selectionBefore);
      }
    },
  };
}
