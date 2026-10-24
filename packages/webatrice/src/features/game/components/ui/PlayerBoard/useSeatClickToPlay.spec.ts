import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import { lookupCard } from '../../../../../services/cards/catalog/lookup';
import type { Preferences } from '../../../../../types';
import { tableRowToGridY } from '../../battlefield/Battlefield/cardPlacement';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCardViewModel,
  PlayerZoneCommands,
} from './playerBoard.types';
import type { SeatCardMeta } from './useSeatCardMetadata';
import { useSeatClickToPlay } from './useSeatClickToPlay';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const card = (id: number, name: string): PlayerCardViewModel => ({ id: String(id), name, scryfallId: '' });
const onTable = (id: number, tapped: boolean): BattlefieldCardViewModel => ({
  ...card(id, `Permanent ${id}`),
  slot: { row: 0, col: 0 },
  subSlot: 0,
  tapped,
});

const FOREST = card(30, 'Forest');
const SHOCK = card(31, 'Shock');
const BEAR = card(32, 'Grizzly Bears');
const META = new Map<string, SeatCardMeta>([
  ['Forest', { typeLine: 'Basic Land — Forest' }],
  ['Shock', { typeLine: 'Instant' }],
  ['Grizzly Bears', { typeLine: 'Creature — Bear' }],
]);

const click = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

const setPreferences = async (patch: Partial<Preferences>) => {
  const settings = await getSettings();
  await act(async () => {
    settingsStore.setValue(Object.assign(settings, patch));
  });
};

function setup(args: Partial<Parameters<typeof useSeatClickToPlay>[0]> = {}, strict = false) {
  const zoneCommands = { moveCards: vi.fn() } as unknown as PlayerZoneCommands;
  const cardCommands = { setTapped: vi.fn() } as unknown as PlayerCardCommands;
  const setCardMetaByName = vi.fn();
  const { result, unmount } = renderHook(() => useSeatClickToPlay({
    canAct: true,
    selection: null,
    handDisplayList: [FOREST, SHOCK, BEAR],
    stackDisplayList: [SHOCK, BEAR],
    battlefieldDisplayList: [onTable(40, false), onTable(41, true), onTable(42, false)],
    cardMetaByName: META,
    setCardMetaByName,
    zoneCommands,
    cardCommands,
    ...args,
  }), { wrapper: strict ? StrictMode : undefined });
  return {
    result, unmount, moveCards: vi.mocked(zoneCommands.moveCards), setTapped: vi.mocked(cardCommands.setTapped), setCardMetaByName,
  };
}

describe('useSeatClickToPlay', () => {
  it('still plays from the mounted seat after StrictMode replays its effects', async () => {
    const { result, moveCards } = setup({}, true);
    result.current.onCardDoubleClick('hand', FOREST, click);
    await waitFor(() => expect(moveCards.mock.calls).toEqual([
      [ZoneName.HAND, [30], { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(0) }],
    ]));
  });

  beforeEach(async () => {
    await getSettings();
  });

  afterEach(() => {
    settingsStore.reset();
  });

  it('plays on a double-click by default, and not on a single click', async () => {
    const { result, moveCards } = setup();
    result.current.onCardClick('hand', FOREST, click, null);
    await Promise.resolve();
    expect(moveCards).not.toHaveBeenCalled();

    result.current.onCardDoubleClick('hand', FOREST, click);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
  });

  it('plays on a single click, and not on a double-click, once double-click to play is off', async () => {
    const { result, moveCards } = setup();
    await setPreferences({ doubleClickToPlay: false });

    result.current.onCardDoubleClick('hand', FOREST, click);
    await Promise.resolve();
    expect(moveCards).not.toHaveBeenCalled();

    result.current.onCardClick('hand', FOREST, click, null);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
  });

  it('still plays with Alt held alongside another modifier, as desktop compares the whole set', async () => {
    const { result, moveCards } = setup();
    result.current.onCardDoubleClick('hand', SHOCK, { ...click, altKey: true, shiftKey: true });
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
    expect(moveCards.mock.calls[0][1]).toEqual([{ id: 31, faceDown: true }]);
  });

  it('never plays with Alt on its own, nor a card of a seat it cannot act for', async () => {
    const own = setup();
    own.result.current.onCardDoubleClick('hand', FOREST, { ...click, altKey: true });
    const other = setup({ canAct: false });
    other.result.current.onCardDoubleClick('hand', FOREST, click);
    await Promise.resolve();
    expect(own.moveCards).not.toHaveBeenCalled();
    expect(other.moveCards).not.toHaveBeenCalled();
  });

  it('routes a card from the hand as desktop\'s playCard does', async () => {
    const { result, moveCards } = setup();
    result.current.onCardDoubleClick('hand', FOREST, click);
    result.current.onCardDoubleClick('hand', SHOCK, click);
    result.current.onCardDoubleClick('hand', BEAR, click);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(3));
    expect(moveCards).toHaveBeenNthCalledWith(1, ZoneName.HAND, [30], { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(0) });
    expect(moveCards).toHaveBeenNthCalledWith(2, ZoneName.HAND, [31], { zone: ZoneName.STACK, index: 'end' });
    expect(moveCards).toHaveBeenNthCalledWith(3, ZoneName.HAND, [32], { zone: ZoneName.STACK, index: 'end' });
  });

  it('plays a permanent straight to the battlefield with "Play all nonlands onto the stack" off', async () => {
    const { result, moveCards } = setup();
    await setPreferences({ playToStack: false });
    result.current.onCardDoubleClick('hand', BEAR, click);
    result.current.onCardDoubleClick('hand', SHOCK, click);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(2));
    expect(moveCards).toHaveBeenNthCalledWith(1, ZoneName.HAND, [32], { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(2) });
    expect(moveCards).toHaveBeenNthCalledWith(2, ZoneName.HAND, [31], { zone: ZoneName.STACK, index: 'end' });
  });

  it('resolves a card from the stack: a spell to the graveyard, anything else onto the battlefield', async () => {
    const { result, moveCards } = setup();
    result.current.onCardDoubleClick('stack', SHOCK, click);
    result.current.onCardDoubleClick('stack', BEAR, click);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(2));
    expect(moveCards).toHaveBeenNthCalledWith(1, ZoneName.STACK, [31], { zone: ZoneName.GRAVE, index: 'end' });
    expect(moveCards).toHaveBeenNthCalledWith(2, ZoneName.STACK, [32], { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(2) });
  });

  it('plays face down onto the battlefield with Shift held', async () => {
    const { result, moveCards } = setup();
    result.current.onCardDoubleClick('hand', SHOCK, { ...click, shiftKey: true });
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
    expect(moveCards).toHaveBeenCalledWith(
      ZoneName.HAND,
      [{ id: 31, faceDown: true }],
      { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(2) },
    );
  });

  it('looks up a card it has no type for, and caches what it found', async () => {
    vi.mocked(lookupCard).mockResolvedValueOnce({
      found: true, source: 'scryfall', name: 'Island', typeLine: 'Basic Land — Island', printings: [],
    } as Awaited<ReturnType<typeof lookupCard>>);
    const island = card(33, 'Island');
    const { result, moveCards, setCardMetaByName } = setup({ handDisplayList: [island] });
    result.current.onCardDoubleClick('hand', island, click);
    await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
    expect(moveCards).toHaveBeenCalledWith(ZoneName.HAND, [33], { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(0) });
    const update = setCardMetaByName.mock.calls[0][0] as (prev: Map<string, SeatCardMeta>) => Map<string, SeatCardMeta>;
    expect(update(new Map()).get('Island')).toMatchObject({ typeLine: 'Basic Land — Island' });
  });

  it('sends nothing when the seat unmounts while the card is still being looked up', async () => {
    let resolveLookup!: (value: Awaited<ReturnType<typeof lookupCard>>) => void;
    vi.mocked(lookupCard).mockReturnValueOnce(new Promise((resolve) => {
      resolveLookup = resolve;
    }));
    const island = card(33, 'Island');
    const { result, unmount, moveCards } = setup({ handDisplayList: [island] });
    result.current.onCardDoubleClick('hand', island, click);
    unmount();
    await act(async () => {
      resolveLookup({
        found: true, source: 'scryfall', name: 'Island', typeLine: 'Basic Land — Island', printings: [],
      } as Awaited<ReturnType<typeof lookupCard>>);
    });
    expect(moveCards).not.toHaveBeenCalled();
  });

  describe('clicking plays all selected cards', () => {
    const selection = { zone: 'hand' as const, ids: new Set(['30', '32']) };

    it('plays the whole selection, highest card id first, when the clicked card is in it', async () => {
      const { result, moveCards } = setup({ selection });
      result.current.onCardDoubleClick('hand', FOREST, click);
      await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(2));
      expect(moveCards.mock.calls.map((call) => call[1])).toEqual([[32], [30]]);
    });

    it('plays only the clicked card when it is not selected', async () => {
      const { result, moveCards } = setup({ selection });
      result.current.onCardDoubleClick('hand', SHOCK, click);
      await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
      expect(moveCards.mock.calls[0][1]).toEqual([31]);
    });

    it('reads a single click\'s selection from before the click, not the one the release made', async () => {
      const { result, moveCards } = setup({ selection: { zone: 'hand', ids: new Set(['30']) } });
      await setPreferences({ doubleClickToPlay: false });
      result.current.onCardClick('hand', FOREST, click, selection);
      await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(2));
      expect(moveCards.mock.calls.map((call) => call[1])).toEqual([[32], [30]]);
    });

    it('plays only the clicked card when the option is off', async () => {
      const { result, moveCards } = setup({ selection });
      await setPreferences({ clickPlaysAllSelected: false });
      result.current.onCardDoubleClick('hand', FOREST, click);
      await waitFor(() => expect(moveCards).toHaveBeenCalledTimes(1));
      expect(moveCards.mock.calls[0][1]).toEqual([30]);
    });
  });

  describe('on the battlefield', () => {
    it('taps or untaps the clicked card', () => {
      const { result, setTapped } = setup();
      result.current.onCardDoubleClick('battlefield', onTable(40, false), click);
      result.current.onCardDoubleClick('battlefield', onTable(41, true), click);
      expect(setTapped).toHaveBeenNthCalledWith(1, [40], true);
      expect(setTapped).toHaveBeenNthCalledWith(2, [41], false);
    });

    it('taps the whole selection unless all of it is tapped, sending only the cards that change', async () => {
      const { result, setTapped } = setup({ selection: { zone: 'battlefield', ids: new Set(['40', '41']) } });
      result.current.onCardDoubleClick('battlefield', onTable(41, true), click);
      expect(setTapped).toHaveBeenCalledWith([40], true);
      await setPreferences({ clickPlaysAllSelected: false });
      result.current.onCardDoubleClick('battlefield', onTable(40, false), click);
      expect(setTapped).toHaveBeenLastCalledWith([40], true);
    });
  });
});
