import { ZoneName } from '@cockatrice/sockatrice';
import { usePreference } from '@app/hooks';
import { useTranslation } from 'react-i18next';

import type { SeatMoveDestination } from '../../ui/PlayerBoard/playerBoard.types';
import { usePlayerSeatContext } from '../../ui/PlayerBoard/PlayerSeatContext';
import { buildRelatedTokenItems, buildTransformItems } from '../CardContextMenu/relatedCardActions';
import { ContextMenuPopup, type ContextMenuItem } from '../ContextMenu/ContextMenu';

export default function StackCardMenu() {
  const { t } = useTranslation();
  const {
    cardCommands,
    cardMetaByName,
    closeSeatCardMenu,
    isSelf,
    relatedViewItemsFor,
    selection,
    startAttach,
    startDrawArrow,
    setSelection,
    menuShortcut,
    stackCardMenu,
    stackDisplayList,
    tokenMetaByName,
    zoneCommands,
  } = usePlayerSeatContext();
  const annotateTokens = usePreference('annotateTokens');

  return (
    <>
      {stackCardMenu &&
      (() => {
        const cardIdNum = Number(stackCardMenu.cardId);
        const card = stackDisplayList.find((sc) => sc.id === stackCardMenu.cardId);
        const numeric = Number.isFinite(cardIdNum) && card != null;
        const close = closeSeatCardMenu;
        // Selection scope: same rule as the battlefield menu — the
        // right-clicked card acts on the whole selection when part
        // of a ≥2 selection on THIS box's stack, else just itself.
        const targets = card
          && selection?.zone === 'stack'
          && selection.ids.has(card.id)
          ? stackDisplayList.filter((sc) => selection.ids.has(sc.id))
          : card
            ? [card]
            : [];
        const targetIds = targets
          .map((sc) => Number(sc.id))
          .filter((n) => Number.isFinite(n));
        if (!isSelf) {
          // Opponent stack — Draw arrow / Clone / Select All only.
          const opponentItems: ContextMenuItem[] = [
            {
              label: t('CardMenu.drawArrow'),
              ...menuShortcut('game.drawArrow'),
              onClick: () => {
                if (numeric && card) {
                  startDrawArrow({
                    sourceCardId: cardIdNum,
                    sourceCardName: card.name,
                    sourceZone: ZoneName.STACK,
                  });
                }
                close();
              },
            },
            { divider: true },
            {
              label: t('CardMenu.clone'),
              ...menuShortcut('game.cloneCard'),
              onClick: () => {
                if (targets.length > 0) {
                  for (const sc of targets) {
                    if (!Number.isFinite(Number(sc.id))) {
                      continue;
                    }
                    cardCommands.clone({
                      name: sc.name,
                      providerId: sc.scryfallId,
                      color: '',
                      pt: '',
                      annotation: sc.annotation ?? '',
                      y: 0,
                    });
                  }
                }
                close();
              },
            },
            { divider: true },
            {
              label: t('CardMenu.selectAll'),
              ...menuShortcut('game.selectAllBattlefield'),
              onClick: () => {
                const ids = new Set(stackDisplayList.map((sc) => sc.id));
                if (ids.size > 0) {
                  setSelection({ zone: 'stack', ids });
                }
                close();
              },
            },
            ...(card ? relatedViewItemsFor(card.name) : []),
            // Related "Token: …" items — same as the battlefield
            // menu. Fires as the LOCAL player so the token lands on
            // OUR side even when right-clicking an opponent's stack
            // card, matching Cockatrice's cross-player Clone rule.
            ...(() => {
              if (!card) {
                return [];
              }
              const tokens = [
                ...buildRelatedTokenItems(
                  t,
                  cardMetaByName.get(card.name)?.related ?? [],
                  tokenMetaByName,
                  cardCommands.createToken,
                  annotateTokens,
                ),
                ...buildTransformItems(
                  t,
                  cardMetaByName.get(card.name),
                  Number.isFinite(cardIdNum) ? cardIdNum : undefined,
                  card.name,
                  cardCommands.createToken,
                  annotateTokens,
                ),
              ];
              return tokens.length > 0
                ? [{ divider: true } as ContextMenuItem, ...tokens]
                : [];
            })(),
          ];
          return (
            <ContextMenuPopup
              items={opponentItems}
              anchor={{ x: stackCardMenu.x, y: stackCardMenu.y }}
              label={card?.name ?? ''}
              onClose={closeSeatCardMenu}
            />
          );
        }
        // Own stack — full menu.
        const moveFromStack = (to: SeatMoveDestination) => {
          if (targetIds.length === 0) {
            return;
          }
          zoneCommands.moveCards(ZoneName.STACK, targetIds, { reversed: false, ...to });
        };
        const items: ContextMenuItem[] = [
          {
            label: t('CardMenu.play'),
            onClick: () => {
              moveFromStack({ zone: ZoneName.TABLE, index: 'end' });
              close();
            },
          },
          {
            label: t('CardMenu.playFaceDown'),
            onClick: () => {
              if (targetIds.length === 0) {
                close();
                return;
              }
              zoneCommands.moveCards(
                ZoneName.STACK,
                targetIds.map((id) => ({ id, faceDown: true as const })),
                { zone: ZoneName.TABLE, index: 'end' },
              );
              close();
            },
          },
          { divider: true },
          {
            label: t('CardMenu.clone'),
            ...menuShortcut('game.cloneCard'),
            onClick: () => {
              if (targets.length > 0) {
                for (const sc of targets) {
                  if (!Number.isFinite(Number(sc.id))) {
                    continue;
                  }
                  cardCommands.clone({
                    name: sc.name,
                    providerId: sc.scryfallId,
                    color: '',
                    pt: '',
                    annotation: sc.annotation ?? '',
                    y: 0,
                  });
                }
              }
              close();
            },
          },
          {
            label: t('CardMenu.moveTo'),
            submenu: [
              {
                label: t('ZoneLabel.title.hand'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.HAND, index: 'end' });
                  close();
                },
              },
              {
                label: t('CardMenu.table'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.TABLE, index: 'end' });
                  close();
                },
              },
              {
                label: t('ZoneLabel.title.grave'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.GRAVE });
                  close();
                },
              },
              {
                label: t('ZoneLabel.title.rfg'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.EXILE });
                  close();
                },
              },
              { divider: true },
              {
                label: t('HandMenu.topLibrary'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.DECK });
                  close();
                },
              },
              {
                label: t('HandMenu.bottomLibrary'),
                onClick: () => {
                  moveFromStack({ zone: ZoneName.DECK, index: 'end' });
                  close();
                },
              },
            ],
          },
          { divider: true },
          {
            label: t('CardMenu.attach'),
            ...menuShortcut('game.attachCard'),
            onClick: () => {
              if (numeric && card) {
                const extras = targets
                  .filter((sc) => Number(sc.id) !== cardIdNum)
                  .map((sc) => Number(sc.id))
                  .filter((n) => Number.isFinite(n));
                startAttach([cardIdNum, ...extras], card.name, ZoneName.STACK);
              }
              close();
            },
          },
          {
            label: t('CardMenu.drawArrow'),
            ...menuShortcut('game.drawArrow'),
            onClick: () => {
              if (numeric && card) {
                startDrawArrow({
                  sourceCardId: cardIdNum,
                  sourceCardName: card.name,
                  sourceZone: ZoneName.STACK,
                });
              }
              close();
            },
          },
          { divider: true },
          {
            label: t('CardMenu.selectAll'),
            ...menuShortcut('game.selectAllBattlefield'),
            onClick: () => {
              const ids = new Set(stackDisplayList.map((sc) => sc.id));
              if (ids.size > 0) {
                setSelection({ zone: 'stack', ids });
              }
              close();
            },
          },
          ...(card ? relatedViewItemsFor(card.name) : []),
          // Related "Token: …" items — same block as the battlefield
          // menu. Divider prefix when non-empty, otherwise omitted so
          // there's no dangling separator at the bottom of the menu.
          ...(() => {
            if (!card) {
              return [];
            }
            const tokens = [
              ...buildRelatedTokenItems(
                t,
                cardMetaByName.get(card.name)?.related ?? [],
                tokenMetaByName,
                cardCommands.createToken,
                annotateTokens,
              ),
              ...buildTransformItems(
                t,
                cardMetaByName.get(card.name),
                Number.isFinite(cardIdNum) ? cardIdNum : undefined,
                card.name,
                cardCommands.createToken,
                annotateTokens,
              ),
            ];
            return tokens.length > 0
              ? [{ divider: true } as ContextMenuItem, ...tokens]
              : [];
          })(),
        ];
        return (
          <ContextMenuPopup
            items={items}
            anchor={{ x: stackCardMenu.x, y: stackCardMenu.y }}
            label={card?.name ?? ''}
            onClose={closeSeatCardMenu}
          />
        );
      })()}
    </>
  );
}
