import {
  applySideboardPlan,
  getSideboardPlan,
  groupDeckZone,
  otherDeckZone,
  parseDeckView,
} from './deckViewModel';

const DECK = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1">
  <deckname>Burn</deckname>
  <zone name="main">
    <card number="2" name="Lightning Bolt"/>
    <card number="1" name="Mountain"/>
  </zone>
  <zone name="side">
    <card number="2" name="Smash to Smithereens"/>
  </zone>
  <zone name="tokens">
    <card number="1" name="Goblin"/>
  </zone>
  <sideboard_plan>
    <name>vs control</name>
    <move_card_to_zone><card_name>Mountain</card_name><start_zone>main</start_zone><target_zone>side</target_zone></move_card_to_zone>
  </sideboard_plan>
  <sideboard_plan>
    <name></name>
    <move_card_to_zone>
      <card_name>Smash to Smithereens</card_name><start_zone>side</start_zone><target_zone>main</target_zone>
    </move_card_to_zone>
  </sideboard_plan>
</cockatrice_deck>`;

describe('parseDeckView', () => {
  it('expands main and side into one entry per copy and ignores other zones', () => {
    const parsed = parseDeckView(DECK)!;
    expect(parsed.view.main.map((c) => c.name)).toEqual(['Lightning Bolt', 'Lightning Bolt', 'Mountain']);
    expect(parsed.view.side.map((c) => c.name)).toEqual(['Smash to Smithereens', 'Smash to Smithereens']);
    expect(parsed.view.side.every((c) => c.originZone === 'side')).toBe(true);
  });

  it('reads only the current (unnamed) sideboard plan', () => {
    expect(parseDeckView(DECK)!.currentPlan).toEqual([
      { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
    ]);
  });

  it('accepts the text form of <card>', () => {
    const parsed = parseDeckView('<cockatrice_deck><zone name="main"><card number="3">Island</card></zone></cockatrice_deck>');
    expect(parsed!.view.main).toHaveLength(3);
  });

  it('returns null for an empty or malformed deck', () => {
    expect(parseDeckView('')).toBeNull();
    expect(parseDeckView('<not-a-deck/>')).toBeNull();
    expect(parseDeckView('<cockatrice_deck>')).toBeNull();
  });
});

describe('applySideboardPlan / getSideboardPlan', () => {
  const { view } = parseDeckView(DECK)!;

  it('moves the first copy with the name and round-trips to the same plan', () => {
    const plan = [
      { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
      { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
    ];
    const next = applySideboardPlan(view, plan);
    expect(next.main.map((c) => c.name)).toEqual(['Lightning Bolt', 'Mountain', 'Smash to Smithereens']);
    expect(next.side.map((c) => c.name)).toEqual(['Smash to Smithereens', 'Lightning Bolt']);
    expect(getSideboardPlan(next)).toEqual([
      { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
      { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
    ]);
  });

  it('does not mutate the input view', () => {
    applySideboardPlan(view, [{ cardName: 'Mountain', startZone: 'main', targetZone: 'side' }]);
    expect(view.main).toHaveLength(3);
  });

  it('skips moves for other zones or missing cards', () => {
    const next = applySideboardPlan(view, [
      { cardName: 'Mountain', startZone: 'deck', targetZone: 'sb' },
      { cardName: 'Island', startZone: 'main', targetZone: 'side' },
    ]);
    expect(getSideboardPlan(next)).toEqual([]);
  });

  it('a card moved out and back leaves no plan entry', () => {
    const out = applySideboardPlan(view, [{ cardName: 'Mountain', startZone: 'main', targetZone: 'side' }]);
    const back = applySideboardPlan(out, [{ cardName: 'Mountain', startZone: 'side', targetZone: 'main' }]);
    expect(getSideboardPlan(back)).toEqual([]);
  });
});

describe('groupDeckZone / otherDeckZone', () => {
  it('groups copies by name in first-seen order', () => {
    expect(groupDeckZone(parseDeckView(DECK)!.view.main)).toEqual([
      { name: 'Lightning Bolt', count: 2 },
      { name: 'Mountain', count: 1 },
    ]);
  });

  it('flips between main and side', () => {
    expect(otherDeckZone('main')).toBe('side');
    expect(otherDeckZone('side')).toBe('main');
  });
});
