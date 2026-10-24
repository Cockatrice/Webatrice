import { buildTrayActions } from './trayActionList';

describe('buildTrayActions', () => {
  it('lists the six tray actions with the fork bindings they print', () => {
    const actions = buildTrayActions({ canAct: true, canRoll: true, deckCount: 40 });
    expect(actions.map((a) => [a.id, a.shortcut, a.disabled])).toEqual([
      ['untapAll', 'game.untapAll', false],
      ['draw', 'game.drawCard', false],
      ['shuffle', 'game.shuffleLibrary', false],
      ['drawN', 'game.drawMultipleCards', false],
      ['rollDie', 'game.rollDice', false],
      ['createToken', 'game.createToken', false],
    ]);
  });

  it('disables library actions on an empty library and shuffling a single card', () => {
    const empty = Object.fromEntries(buildTrayActions({ canAct: true, canRoll: true, deckCount: 0 }).map((a) => [a.id, a.disabled]));
    expect(empty).toMatchObject({ untapAll: false, draw: true, shuffle: true, drawN: true, rollDie: false, createToken: false });
    const one = Object.fromEntries(buildTrayActions({ canAct: true, canRoll: true, deckCount: 1 }).map((a) => [a.id, a.disabled]));
    expect(one).toMatchObject({ draw: false, shuffle: true, drawN: false });
  });

  it('disables everything that acts on the seat when the viewer cannot act', () => {
    const actions = buildTrayActions({ canAct: false, canRoll: false, deckCount: 40 });
    expect(actions.every((a) => a.disabled)).toBe(true);
  });
});
