import { act, render, screen } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';

import { createPendingPointerStore } from '../../../hooks/pendingPointerStore';
import type { PendingTarget, PendingTargetPicker } from '../../../hooks/usePendingTarget';
import { PendingTargetProvider } from '../PendingTargetContext';
import PendingTargetArrows from './PendingTargetArrows';

const added: HTMLElement[] = [];

function cardElement(playerId: number, zone: string, cardId: number) {
  const el = document.createElement('div');
  el.setAttribute('data-card-id', String(cardId));
  el.setAttribute('data-card-owner', String(playerId));
  el.setAttribute('data-card-zone', zone);
  document.body.appendChild(el);
  added.push(el);
}

afterEach(() => {
  added.splice(0).forEach((el) => el.remove());
});

function renderArrows(pending: PendingTarget) {
  const pointer = createPendingPointerStore();
  const picker = { pending, pointer } as PendingTargetPicker;
  render(
    <PendingTargetProvider value={picker}>
      <PendingTargetArrows playerId={1} pending={pending} />
    </PendingTargetProvider>,
  );
  return pointer;
}

const arrows = () => screen.queryByTestId('pending-target-arrows');

describe('PendingTargetArrows', () => {
  it('draws nothing until the pointer moves, then one arrow per attaching card', () => {
    cardElement(1, ZoneName.TABLE, 10);
    cardElement(1, ZoneName.TABLE, 11);
    const pointer = renderArrows({
      kind: 'attach',
      source: { playerId: 1, zone: ZoneName.TABLE, cardId: 10, name: 'Aura' },
      extraSourceIds: [11],
    });
    expect(arrows()).toBeNull();

    act(() => pointer.set({ x: 300, y: 200 }));
    expect(arrows()!.querySelectorAll('path')).toHaveLength(2);
  });

  it('draws from the source card in its own zone', () => {
    cardElement(1, ZoneName.STACK, 40);
    const pointer = renderArrows({ kind: 'arrow', source: { playerId: 1, zone: ZoneName.STACK, cardId: 40, name: 'Shock' } });
    act(() => pointer.set({ x: 300, y: 200 }));
    expect(arrows()!.querySelectorAll('path')).toHaveLength(1);
  });
});
