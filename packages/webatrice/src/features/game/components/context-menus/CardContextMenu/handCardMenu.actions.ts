
import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import type { TFunction } from 'i18next';

import type { SeatCardMenuState } from '../../../hooks/dialogs/gameDialogs.types';
import type { SeatSelection } from '../../../hooks/useSeatSelection';
import { makeCardKey, parseCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import {
  resolveCardTableRow,
  playedCardFields,
  tableRowToGridY,
  type PlayedCardMeta,
  type CardPlacementMeta,
} from '../../battlefield/Battlefield/cardPlacement';
import type {
  PlayerCardViewModel,
  SeatMoveCard,
  SeatMoveDestination,
} from '../../ui/PlayerBoard/playerBoard.types';
import { moveSelectedCards } from '../../ui/PlayerBoard/selectionMoves';
import type { ContextMenuItem, MenuShortcutFor } from '../ContextMenu/ContextMenu';
import { buildHandOrZoneCardMenu } from './handCardMenu.model';

export interface PlayCardMeta extends PlayedCardMeta, CardPlacementMeta {
  typeLine: string;
}

export function playCardMove(
  cardId: number,
  meta: PlayCardMeta | undefined,
  { faceDown = false, playToStack = false, fromStack = false }: {
    faceDown?: boolean;
    playToStack?: boolean;
    fromStack?: boolean;
  } = {},
): { card: SeatMoveCard; to: SeatMoveDestination } {
  const tableRow = resolveCardTableRow(meta);
  if (!faceDown && fromStack && tableRow === 3) {
    return { card: cardId, to: { zone: ZoneName.GRAVE, index: 'end' } };
  }
  if (!faceDown && !fromStack && (playToStack ? tableRow !== 0 : tableRow === 3)) {
    return { card: cardId, to: { zone: ZoneName.STACK, index: 'end' } };
  }
  const fields = playedCardFields(meta, faceDown);
  const card: SeatMoveCard = faceDown
    ? { id: cardId, faceDown: true }
    : fields.pt || fields.tapped ? { id: cardId, ...fields } : cardId;
  return { card, to: { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(faceDown ? 2 : tableRow) } };
}

export function playCardMoves(
  cards: readonly { id: string; name: string }[],
  cardMeta: (name: string) => PlayCardMeta | undefined,
  options: { faceDown: boolean; playToStack?: boolean },
): { card: SeatMoveCard; to: SeatMoveDestination }[] {
  return [...cards]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .map((c) => playCardMove(Number(c.id), cardMeta(c.name), options));
}

export function selectedHiddenZoneCards(
  seatId: number,
  handSelection: SeatSelection | null,
  selectedCardKeys: ReadonlySet<string>,
): { zone: ZoneNameValue; cardIds: number[] } | null {
  if (handSelection?.zone === 'hand') {
    const cardIds = Array.from(handSelection.ids, Number).filter((n) => Number.isFinite(n));
    return cardIds.length > 0 ? { zone: ZoneName.HAND, cardIds } : null;
  }
  const picked = Array.from(selectedCardKeys, (key) => parseCardKey(key));
  const zone = picked[0]?.zone;
  if (
    picked.length === 0 ||
    (zone !== ZoneName.DECK && zone !== ZoneName.SIDEBOARD) ||
    !picked.every((p) => p?.playerId === seatId && p.zone === zone)
  ) {
    return null;
  }
  return { zone, cardIds: picked.map((p) => p!.cardId) };
}

export interface HandOrZoneCardMenuDeps {
  t: TFunction;
  menu: SeatCardMenuState | null;
  ownerId: number;
  menuShortcut: MenuShortcutFor;
  canModify: boolean;
  revealTargets: readonly { playerId: number; name: string }[];
  handCards: readonly PlayerCardViewModel[];
  zoneViewCards: readonly PlayerCardViewModel[];
  handSelection: SeatSelection | null;
  setHandSelection: (next: SeatSelection | null) => void;
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: (next: ReadonlySet<string>) => void;
  cardMeta: (name: string) => PlayCardMeta | undefined;
  deckSize: number;
  playToStack?: boolean;
  moveCards?: (from: string, cards: readonly SeatMoveCard[], to: SeatMoveDestination) => void;
  revealCards?: (zone: string, targetPlayerId: number, cardIds: readonly number[]) => void;
  cloneCard?: (source: {
    name: string;
    providerId: string;
    color: string;
    pt: string;
    annotation: string;
    y: number;
  }) => void;
  promptMoveXFromTop: (args: { cardIds: number[]; cardName: string; deckSize: number; fromZone: string }) => void;
  startArrow: (source: { sourceCardId: number; sourceCardName: string; sourceZone: string }) => void;
  relatedViewItems: (cardName: string) => ContextMenuItem[];
  tokenItems: (cardName: string) => ContextMenuItem[];
  close: () => void;
}

export interface SeatCardMenuModel {
  items: ContextMenuItem[];
  anchor: { x: number; y: number };
  label: string;
}

export function resolveHandOrZoneCardMenu(deps: HandOrZoneCardMenuDeps): SeatCardMenuModel | null {
  const { menu } = deps;
  if (menu?.kind !== 'hand' && menu?.kind !== 'zoneView') {
    return null;
  }
  const zoneView = menu.kind === 'zoneView' ? menu : null;
  const zone = zoneView?.zone ?? ZoneName.HAND;
  const zoneCards = zoneView ? deps.zoneViewCards : deps.handCards;
  const viewKey = (id: string) => makeCardKey(deps.ownerId, zone, Number(id));

  let targetIdStrings: string[];
  if (zoneView) {
    const selectedInView = zoneView.viewCardIds.filter((id) => deps.selectedCardKeys.has(viewKey(id)));
    targetIdStrings = selectedInView.includes(menu.cardId) ? selectedInView : [menu.cardId];
  } else {
    targetIdStrings = deps.handSelection?.zone === 'hand' && deps.handSelection.ids.has(menu.cardId)
      ? Array.from(deps.handSelection.ids)
      : [menu.cardId];
  }
  const targets = targetIdStrings
    .map((id) => zoneCards.find((c) => c.id === id))
    .filter((c): c is PlayerCardViewModel => c != null && Number.isFinite(Number(c.id)));
  const targetIds = targets.map((c) => Number(c.id));
  const cardName = zoneCards.find((c) => c.id === menu.cardId)?.name ?? zoneView?.cardName ?? '';
  const cardIdNum = Number(menu.cardId);
  const numeric = Number.isFinite(cardIdNum);

  const run = (fn: () => void) => () => {
    fn();
    deps.close();
  };
  const moveTargets = (to: SeatMoveDestination) => {
    if (deps.moveCards) {
      moveSelectedCards(deps.moveCards, zone, targets, to, deps.cardMeta);
    }
  };
  const selectInView = (ids: readonly string[]) => deps.setSelectedCardKeys(new Set(ids.map(viewKey)));
  const play = (faceDown: boolean) => run(() => {
    for (const { card, to } of playCardMoves(targets, deps.cardMeta, { faceDown, playToStack: deps.playToStack })) {
      deps.moveCards?.(zone, [card], to);
    }
  });

  const items = buildHandOrZoneCardMenu({
    t: deps.t,
    menuShortcut: deps.menuShortcut,
    source: zoneView ? 'zoneView' : 'hand',
    canModify: deps.canModify,
    revealTargets: deps.revealTargets,
    onPlay: play(false),
    onPlayFaceDown: play(true),
    onReveal: (targetPlayerId) => run(() => {
      if (targetIds.length > 0) {
        deps.revealCards?.(zone, targetPlayerId, targetIds);
      }
    })(),
    onClone: run(() => {
      for (const c of targets) {
        deps.cloneCard?.({ name: c.name, providerId: c.scryfallId, color: '', pt: '', annotation: '', y: 0 });
      }
    }),
    onMove: (target) => run(() => {
      switch (target) {
        case 'libraryTop':
          return moveTargets({ zone: ZoneName.DECK });
        case 'libraryBottom':
          return moveTargets({ zone: ZoneName.DECK, reversed: true });
        case 'libraryXFromTop':
          if (targetIds.length > 0) {
            deps.promptMoveXFromTop({ cardIds: targetIds, cardName, deckSize: deps.deckSize, fromZone: zone });
          }
          return;
        case 'table':
          return moveTargets({ zone: ZoneName.TABLE });
        case 'hand':
          return moveTargets({ zone: ZoneName.HAND });
        case 'grave':
          return moveTargets({ zone: ZoneName.GRAVE });
        case 'exile':
          return moveTargets({ zone: ZoneName.EXILE });
      }
    })(),
    onDrawArrow: run(() => {
      if (numeric) {
        deps.startArrow({ sourceCardId: cardIdNum, sourceCardName: cardName, sourceZone: zone });
      }
    }),
    onSelectAll: run(() => {
      if (zoneView) {
        selectInView(zoneView.viewCardIds);
      } else if (deps.handCards.length > 0) {
        deps.setHandSelection({ zone: 'hand', ids: new Set(deps.handCards.map((c) => c.id)) });
      }
    }),
    onSelectColumn: zoneView ? run(() => selectInView(zoneView.columnCardIds)) : undefined,
    relatedViewItems: deps.relatedViewItems(cardName),
    tokenItems: deps.tokenItems(cardName),
  });
  return { items, anchor: { x: menu.x, y: menu.y }, label: cardName };
}
