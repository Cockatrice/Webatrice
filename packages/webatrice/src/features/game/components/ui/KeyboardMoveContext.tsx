import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import MoveCardsDialog, { type MoveCardsRequest } from '../../dialogs/MoveCardsDialog/MoveCardsDialog';
import type { SeatDragSource, SeatDropTarget } from '../../hooks/seatDropPlan';
import { BattlefieldGeometryContext, createBattlefieldGeometryRegistry } from './BattlefieldGeometryContext';

export type RequestKeyboardMove = (request: MoveCardsRequest) => void;

const KeyboardMoveContext = createContext<RequestKeyboardMove | null>(null);

export function KeyboardMoveProvider({
  moveSeatCards,
  children,
}: {
  moveSeatCards: (source: SeatDragSource, target: SeatDropTarget) => void;
  children: ReactNode;
}) {
  const [request, setRequest] = useState<MoveCardsRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);
  const geometry = useMemo(createBattlefieldGeometryRegistry, []);
  return (
    <BattlefieldGeometryContext.Provider value={geometry}>
      <KeyboardMoveContext.Provider value={setRequest}>
        {children}
        {request && (
          <MoveCardsDialog
            request={request}
            onCancel={close}
            onMove={(target) => {
              close();
              moveSeatCards(request.source, target);
            }}
          />
        )}
      </KeyboardMoveContext.Provider>
    </BattlefieldGeometryContext.Provider>
  );
}

export function useKeyboardMove(): RequestKeyboardMove | null {
  return useContext(KeyboardMoveContext);
}
