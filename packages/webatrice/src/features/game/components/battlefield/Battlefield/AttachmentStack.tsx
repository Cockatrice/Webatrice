import { memo } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { games } from '@cockatrice/datatrice';

import CardSlot from '../../ui/CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../../ui/GameInteractionContext';
import { attachmentSlotLayout } from './gridMath';

import './AttachmentStack.css';

export interface AttachmentStackProps {
  parent: ServerInfo_Card;
  ownerPlayerId: number;
  attachments: games.AttachedChild[];
  draggable: boolean;
  arrowSourceKey: string | null;
  selectedCardKey: string | null;
}

function AttachmentStack({
  parent,
  attachments,
  draggable,
  ownerPlayerId,
  arrowSourceKey,
  selectedCardKey,
}: AttachmentStackProps) {
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick, onCardFocus, onCardBlur } = useGameInteraction();
  const parentKey = makeCardKey(ownerPlayerId, Enriched.ZoneName.TABLE, parent.id);

  const N = attachments.length;
  const parentSlot = attachmentSlotLayout(N, -1);

  return (
    <div className="attachment-stack">
      <div
        className="attachment-stack__parent"
        style={{
          left: `${parentSlot.leftPct}%`,
          top: `${parentSlot.topPct}%`,
          width: `${parentSlot.widthPct}%`,
          zIndex: parentSlot.zIndex,
        }}
      >
        <CardSlot
          card={parent}
          draggable={draggable}
          ownerPlayerId={ownerPlayerId}
          zone={Enriched.ZoneName.TABLE}
          isArrowSource={arrowSourceKey === parentKey}
          isSelected={selectedCardKey === parentKey}
          onMouseEnter={onCardHover}
          onFocus={onCardFocus}
          onBlur={onCardBlur}
          onClick={onCardClick}
          onContextMenu={onCardContextMenu}
          onDoubleClick={onCardDoubleClick}
        />
      </div>
      {attachments.map((entry, i) => {
        const { card: child, ownerPlayerId: childOwnerId } = entry;
        const childKey = makeCardKey(childOwnerId, Enriched.ZoneName.TABLE, child.id);
        const slot = attachmentSlotLayout(N, i);
        return (
          <div
            key={child.id}
            className="attachment-stack__child"
            style={{
              left: `${slot.leftPct}%`,
              top: `${slot.topPct}%`,
              width: `${slot.widthPct}%`,
              zIndex: slot.zIndex,
            }}
          >
            <CardSlot
              card={child}
              draggable={draggable}
              ownerPlayerId={childOwnerId}
              zone={Enriched.ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              isSelected={selectedCardKey === childKey}
              onMouseEnter={onCardHover}
              onFocus={onCardFocus}
              onBlur={onCardBlur}
              onClick={onCardClick}
              onContextMenu={onCardContextMenu}
              onDoubleClick={onCardDoubleClick}
            />
          </div>
        );
      })}
    </div>
  );
}

export default memo(AttachmentStack);
