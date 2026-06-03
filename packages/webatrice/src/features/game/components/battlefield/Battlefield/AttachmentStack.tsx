import { ZoneName } from '@cockatrice/sockatrice';
import { memo } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';

import CardSlot from '../../ui/CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../../ui/GameInteractionContext';
import { useCardVisualState } from '../../ui/CardVisualStateContext';
import { attachmentSlotLayout } from './gridMath';

import './AttachmentStack.css';

export interface AttachmentStackProps {
  parent: ServerInfo_Card;
  ownerPlayerId: number;
  attachments: games.AttachedChild[];
  draggable: boolean;
}

function AttachmentStack({
  parent,
  attachments,
  draggable,
  ownerPlayerId,
}: AttachmentStackProps) {
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick, onCardFocus, onCardBlur } = useGameInteraction();
  const { arrowSourceKey, arrowTargetKey, selectedCardKeys } = useCardVisualState();
  const parentKey = makeCardKey(ownerPlayerId, ZoneName.TABLE, parent.id);

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
          zone={ZoneName.TABLE}
          isArrowSource={arrowSourceKey === parentKey}
          isArrowTarget={arrowTargetKey === parentKey}
          isSelected={selectedCardKeys.has(parentKey)}
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
        const childKey = makeCardKey(childOwnerId, ZoneName.TABLE, child.id);
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
              zone={ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              isArrowTarget={arrowTargetKey === childKey}
              isSelected={selectedCardKeys.has(childKey)}
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
