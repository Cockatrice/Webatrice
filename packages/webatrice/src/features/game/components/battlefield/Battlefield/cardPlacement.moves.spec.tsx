import { act, waitFor } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { CardDTO, lookupCard } from '@app/services';

import { testI18n } from '../../../../../__test-utils__/renderWithProviders';
import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import { renderSeatHook } from '../../../__test-utils__/seatFixtures';
import { autoPlayCard, playCardViaTableRow } from '../../../hooks/playCard';
import { resolveHandOrZoneCardMenu } from '../../context-menus/CardContextMenu/handCardMenu.actions';
import { usePlayerCardCommands } from '../../ui/GameBoardCell/usePlayerCardCommands';
import { usePlayerZoneCommands } from '../../ui/GameBoardCell/usePlayerZoneCommands';
import { moveSelectedCards } from '../../ui/PlayerBoard/selectionMoves';
import { useSeatClickToPlay } from '../../ui/PlayerBoard/useSeatClickToPlay';
import { seatCardMetaFromLookup } from '../../ui/PlayerBoard/useSeatCardMetadata';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const card = makeCard({ id: 7, name: 'Placement fixture' });
const view = { id: '7', name: card.name, scryfallId: '' };
const click = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

const cases = [
  { typeLine: 'Creature — Bear', tableRow: 1, y: 1 },
  { typeLine: 'Artifact', tableRow: 2, y: 0 },
  { typeLine: 'Creature — Bear', tableRow: 0, y: 2 },
  { typeLine: 'Creature — Bear', tableRow: 3, y: 1, spell: true },
  { typeLine: 'Instant', tableRow: 2, y: 0 },
  { typeLine: '', tableRow: 0, y: 2 },
  { typeLine: 'Artifact', tableRow: 9, y: 1 },
  { typeLine: 'Basic Land — Forest', y: 2 },
  { typeLine: 'Creature — Bear', y: 0 },
  { typeLine: 'Artifact Creature — Golem', y: 0 },
  { typeLine: 'Land Creature — Forest Dryad', y: 0 },
  { typeLine: 'Instant', y: 1, spell: true },
  { typeLine: 'Sorcery — Adventure', y: 1, spell: true },
  { typeLine: 'Artifact', y: 1 },
  { typeLine: 'Enchantment — Aura', y: 1 },
  { typeLine: 'Legendary Planeswalker — Jace', y: 1 },
  { typeLine: 'Battle — Siege', y: 1 },
  { typeLine: 'Legendary Planeswalker Creature', y: 1 },
  { typeLine: 'Creature // Instant — Adventure', y: 0 },
  { typeLine: 'Land Instant', y: 2 },
  { typeLine: 'Enchantment — Instant Creature Land', y: 1 },
  { typeLine: '', y: 1 },
] satisfies Array<{ typeLine: string; tableRow?: number; y: number; spell?: boolean }>;

beforeEach(async () => {
  const settings = await getSettings();
  settingsStore.setValue(Object.assign(settings, { playToStack: false, doubleClickToPlay: true }));
});

afterEach(() => act(() => settingsStore.reset()));

describe.each(cases)('placement: $typeLine, database row $tableRow', (fixture) => {
  function setup(singleClick = false) {
    const tableRow = 'tableRow' in fixture ? fixture.tableRow : undefined;
    vi.spyOn(CardDTO, 'get').mockResolvedValue(tableRow === undefined ? undefined : {
      tablerow: { value: String(tableRow) },
      prop: { value: { type: { value: fixture.typeLine } } },
    } as never);
    const lookup = {
      found: true, source: tableRow === undefined ? 'scryfall' as const : 'dexie' as const,
      name: card.name, printings: [], typeLine: fixture.typeLine, tableRow,
    };
    vi.mocked(lookupCard).mockResolvedValue(lookup);
    if (singleClick) {
      settingsStore.setValue(Object.assign(settingsStore.getSnapshot().value!, { doubleClickToPlay: false }));
    }
    const meta = seatCardMetaFromLookup(lookup);
    const utils = renderSeatHook(() => {
      const zone = usePlayerZoneCommands(1)!;
      const tokens = usePlayerCardCommands(1, true)!;
      const clicks = useSeatClickToPlay({
        canAct: true, selection: null, handDisplayList: [view], stackDisplayList: [view],
        battlefieldDisplayList: [], cardMetaByName: new Map([[card.name, meta]]),
        setCardMetaByName: vi.fn(), zoneCommands: zone, cardCommands: tokens,
      });
      return { zone, tokens, clicks };
    }, { localPlayerId: 1, seats: [{ playerId: 1, hand: [card] }, { playerId: 2 }] });
    return { ...utils, meta };
  }

  const isSpell = 'spell' in fixture && fixture.spell;
  const playZone = isSpell ? ZoneName.STACK : ZoneName.TABLE;
  const playY = isSpell ? 0 : fixture.y;

  it.each(['direct', 'auto'] as const)('%s play sends the resolved row', async (entry) => {
    const { webClient, game } = setup();
    await act(async () => {
      const args = {
        webClient, gameId: 1, sourcePlayerId: 1, sourceZone: ZoneName.HAND,
        card, faceDown: false, isInverted: false, playToStack: false,
      };
      await (entry === 'direct' ? playCardViaTableRow : autoPlayCard)(args);
    });
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      targetZone: playZone, x: -1, y: playY,
    });
  });

  it('hand menu Play sends the resolved row through the seat commands', () => {
    const { result, meta, game } = setup();
    const menu = resolveHandOrZoneCardMenu({
      t: testI18n.t,
      menu: { kind: 'hand', playerId: 1, cardId: '7', x: 0, y: 0 },
      ownerId: 1, menuShortcut: () => ({ shortcut: '', keyShortcuts: '' }), canModify: true,
      revealTargets: [], handCards: [view], zoneViewCards: [],
      handSelection: null, setHandSelection: vi.fn(), selectedCardKeys: new Set(),
      setSelectedCardKeys: vi.fn(), cardMeta: () => meta, deckSize: 0,
      moveCards: result().zone.moveCards, promptMoveXFromTop: vi.fn(), startArrow: vi.fn(),
      relatedViewItems: () => [], tokenItems: () => [], close: vi.fn(),
    })!;
    const play = menu.items.find((item) => 'label' in item && item.label === 'Play');
    if (!play || !('onClick' in play)) {
      throw new Error('Play menu item missing');
    }
    act(() => play.onClick!());
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ targetZone: playZone, x: -1, y: playY });
  });

  it.each([false, true])('seat play (single click: %s) sends the resolved row', async (singleClick) => {
    const { result, game } = setup(singleClick);
    await act(async () => {
      if (singleClick) {
        result().clicks.onCardClick('hand', view, click, null);
      } else {
        result().clicks.onCardDoubleClick('hand', view, click);
      }
    });
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ targetZone: playZone, x: -1, y: playY });
  });

  it('Move to Table sends the resolved row, including for spells', () => {
    const { result, meta, game } = setup();
    act(() => moveSelectedCards(result().zone.moveCards, ZoneName.HAND, [view], { zone: ZoneName.TABLE }, () => meta));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ targetZone: ZoneName.TABLE, x: -1, y: fixture.y });
  });

  it('a stack double-click resolves using the database row or maintype', async () => {
    const { result, game } = setup();
    await act(async () => result().clicks.onCardDoubleClick('stack', view, click));
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      targetZone: isSpell ? ZoneName.GRAVE : ZoneName.TABLE, x: -1, y: isSpell ? 0 : fixture.y,
    });
  });

  it('token creation sends the resolved row, including for spells', async () => {
    const { result, game } = setup();
    await act(async () => {
      await result().tokens.createToken({
        name: card.name, color: '', pt: '', annotation: '', destroyOnZoneChange: true, faceDown: false,
      });
    });
    expect(game.createToken).toHaveBeenCalledWith(1, expect.objectContaining({ zone: ZoneName.TABLE, x: -1, y: fixture.y }));
  });
});

it.each(['direct', 'auto'] as const)('%s face-down play overrides a spell database row', async (entry) => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ tablerow: { value: '3' } } as never);
  const { webClient, game } = renderSeatHook(() => null, {
    localPlayerId: 1, seats: [{ playerId: 1, hand: [card] }, { playerId: 2 }],
  });
  await (entry === 'direct' ? playCardViaTableRow : autoPlayCard)({
    webClient, gameId: 1, sourcePlayerId: 1, sourceZone: ZoneName.HAND,
    card, faceDown: true, isInverted: false,
  });
  expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
    targetZone: ZoneName.TABLE, x: -1, y: 0, cardsToMove: { card: [{ cardId: 7, faceDown: true }] },
  });
});
