import { act, waitFor } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { lookupCardsCached } from '../../../services/cards/catalog/lookup';
import { GameIdProvider } from '../components/ui/GameIdContext';
import { GameSelectionProvider } from '../components/ui/GameSelectionContext';
import { buildSeatGameState } from '../__test-utils__/seatFixtures';
import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { useSelectionTally, type SelectionTally } from './useSelectionTally';
import { useTallyType } from './useTallyType';
import type { TallyType } from '../utils/tally';

vi.mock('../../../hooks/useSettings');

vi.mock('../../../services/cards/catalog/lookup', () => ({
  lookupCardsCached: vi.fn(),
}));

const CATALOG: Record<string, { typeLine: string; power?: string; toughness?: string }> = {
  'Goblin Guide': { typeLine: 'Creature — Goblin Scout', power: '2', toughness: '2' },
  'Bear': { typeLine: 'Creature — Bear', power: '2', toughness: '2' },
  'Bolt': { typeLine: 'Instant' },
};

const GUIDE = makeCard({ id: 10, name: 'Goblin Guide', pt: '3/1' });
const BOLT = makeCard({ id: 11, name: 'Bolt' });
const BEAR = makeCard({ id: 20, name: 'Bear' });
const MORPH = makeCard({ id: 21, name: '', faceDown: true, pt: '2/2' });

const latest: { tally?: SelectionTally; setType?: (t: TallyType) => void } = {};

function Probe() {
  latest.tally = useSelectionTally();
  latest.setType = useTallyType()[1];
  return null;
}

function renderTally(keys: string[]) {
  const preloadedState = buildSeatGameState({
    localPlayerId: 1,
    seats: [
      { playerId: 1, table: [GUIDE], hand: [BOLT, BEAR] },
      { playerId: 2, table: [BEAR, MORPH] },
    ],
  });
  renderWithProviders(
    <GameIdProvider value={1}>
      <GameSelectionProvider selectedCardKeys={new Set(keys)} setSelectedCardKeys={() => {}}>
        <Probe />
      </GameSelectionProvider>
    </GameIdProvider>,
    { preloadedState, webClient: createMockWebClient() },
  );
}

beforeEach(() => {
  vi.mocked(lookupCardsCached).mockImplementation(async (names: string[]) =>
    new Map(names.map((name) => [name, { found: true, source: 'dexie' as const, name, printings: [], ...CATALOG[name] }])));
});

afterEach(() => {
  act(() => latest.setType?.('none'));
});

const ALL = [
  makeCardKey(1, ZoneName.TABLE, 10),
  makeCardKey(1, ZoneName.HAND, 11),
  makeCardKey(2, ZoneName.TABLE, 20),
  makeCardKey(2, ZoneName.TABLE, 21),
];

describe('useSelectionTally', () => {
  it('has no rows under None but still counts the selection', () => {
    renderTally(ALL);
    expect(latest.tally).toEqual({ rows: [], count: 4 });
  });

  it('sums power across seats and zones, the live P/T first, else the printed one', async () => {
    renderTally(ALL);
    act(() => latest.setType!('power'));
    await waitFor(() => expect(latest.tally!.rows).toEqual([{ name: 'Total Power', value: '7' }]));
  });

  it('uses printed P/T only on the battlefield, while hand cards still count and have types', async () => {
    renderTally([makeCardKey(1, ZoneName.HAND, 20), makeCardKey(2, ZoneName.TABLE, 20)]);
    act(() => latest.setType!('subtypes'));
    await waitFor(() => expect(latest.tally!.rows).toEqual([{ name: 'Bear', value: '2' }]));
    act(() => latest.setType!('power'));
    expect(latest.tally).toEqual({ rows: [{ name: 'Total Power', value: '2' }], count: 2 });
  });

  it('counts the subtypes of the face-up selected cards from the catalog', async () => {
    renderTally(ALL);
    act(() => latest.setType!('subtypes'));
    await waitFor(() => expect(latest.tally!.rows).toEqual([
      { name: 'Bear', value: '1' },
      { name: 'Goblin', value: '1' },
      { name: 'Scout', value: '1' },
    ]));
  });
});
