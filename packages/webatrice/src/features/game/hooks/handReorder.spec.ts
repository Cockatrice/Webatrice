import { planHandReorder } from './handReorder';

function applyPlan(hand: string[], plan: { cardId: string; x: number }[]): string[] {
  const order = hand.slice();
  for (const { cardId, x } of plan) {
    order.splice(order.indexOf(cardId), 1);
    order.splice(Math.min(x, order.length), 0, cardId);
  }
  return order;
}

describe('planHandReorder', () => {
  it('sends the drop index as x for a single card', () => {
    expect(planHandReorder(['A', 'B', 'C'], ['A'], 2)).toEqual([{ cardId: 'A', x: 2 }]);
    expect(planHandReorder(['A', 'B', 'C'], ['C'], 0)).toEqual([{ cardId: 'C', x: 0 }]);
    expect(planHandReorder(['A', 'B', 'C'], ['B'], 1)).toEqual([{ cardId: 'B', x: 1 }]);
  });

  it('moves a group to the end in its current order', () => {
    const plan = planHandReorder(['A', 'B', 'C'], ['A', 'B'], 1);

    expect(plan).toEqual([{ cardId: 'A', x: 2 }, { cardId: 'B', x: 2 }]);
    expect(applyPlan(['A', 'B', 'C'], plan)).toEqual(['C', 'A', 'B']);
  });

  it('orders the group by hand position, not selection order', () => {
    const plan = planHandReorder(['A', 'B', 'C', 'D'], ['D', 'B'], 0);

    expect(plan.map((step) => step.cardId)).toEqual(['B', 'D']);
    expect(applyPlan(['A', 'B', 'C', 'D'], plan)).toEqual(['B', 'D', 'A', 'C']);
  });

  it.each([
    { dragged: ['B', 'D'], target: 0, expected: ['B', 'D', 'A', 'C', 'E'] },
    { dragged: ['B', 'D'], target: 1, expected: ['A', 'B', 'D', 'C', 'E'] },
    { dragged: ['B', 'D'], target: 2, expected: ['A', 'C', 'B', 'D', 'E'] },
    { dragged: ['B', 'D'], target: 3, expected: ['A', 'C', 'E', 'B', 'D'] },
    { dragged: ['A', 'E'], target: 1, expected: ['B', 'A', 'E', 'C', 'D'] },
    { dragged: ['C', 'D', 'E'], target: 0, expected: ['C', 'D', 'E', 'A', 'B'] },
  ])('places $dragged at slot $target among the other cards', ({ dragged, target, expected }) => {
    const hand = ['A', 'B', 'C', 'D', 'E'];

    expect(applyPlan(hand, planHandReorder(hand, dragged, target))).toEqual(expected);
  });

  it('lands every group contiguous at its slot, and survives the echo replay', () => {
    const hand = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let mask = 1; mask < 1 << hand.length; mask++) {
      const dragged = hand.filter((_, i) => mask & (1 << i));
      const others = hand.filter((id) => !dragged.includes(id));
      for (let target = 0; target <= others.length; target++) {
        const plan = planHandReorder(hand, dragged, target);
        const once = applyPlan(hand, plan);

        expect(once).toEqual([...others.slice(0, target), ...dragged, ...others.slice(target)]);
        expect(applyPlan(once, plan)).toEqual(once);
      }
    }
  });

  it('clamps an out-of-range target to the end', () => {
    expect(applyPlan(['A', 'B', 'C'], planHandReorder(['A', 'B', 'C'], ['A'], 9))).toEqual(['B', 'C', 'A']);
  });

  it('ignores ids that are not in the hand', () => {
    expect(planHandReorder(['A', 'B'], ['Z'], 0)).toEqual([]);
  });
});
