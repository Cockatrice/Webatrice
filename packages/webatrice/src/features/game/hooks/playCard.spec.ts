import { ZoneName } from '@cockatrice/sockatrice';
import { describe, expect, it, vi } from 'vitest';

import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { autoPlayCard, playCardViaTableRow } from './playCard';

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(() => Promise.resolve(undefined)) },
}));

vi.mock('../../../services/cards/catalog/lookup', async () =>
  (await import('../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

function makeWebClient() {
  const moveCard = vi.fn();
  return { webClient: { request: { game: { moveCard } } } as never, moveCard };
}

const baseArgs = {
  gameId: 1,
  sourceZone: ZoneName.HAND,
  card: { id: 7, name: 'Bear' } as never,
  faceDown: false,
  isInverted: false,
};

describe('playCardViaTableRow — owner routing + judge wrap', () => {
  it('plays an own card onto the local table, sent bare (no judge wrap)', async () => {
    vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: '1' } } as never);
    const { webClient, moveCard } = makeWebClient();

    await playCardViaTableRow({ ...baseArgs, webClient, sourcePlayerId: 1 });

    expect(moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        targetPlayerId: 1,
        targetZone: ZoneName.TABLE,
      }),
      undefined,
    );
  });

  it('a judge plays a foreign card onto the owner table, wrapped in Command_Judge(target=owner)', async () => {
    vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: '1' } } as never);
    const { webClient, moveCard } = makeWebClient();

    // sourcePlayerId is the card owner; judgeTargetId resolves to the same owner.
    await playCardViaTableRow({ ...baseArgs, webClient, sourcePlayerId: 2, judgeTargetId: 2 });

    expect(moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 2,
        targetPlayerId: 2,
        targetZone: ZoneName.TABLE,
      }),
      2,
    );
  });

  it('routes an instant (tablerow=3) to the owner stack with the judge wrap', async () => {
    vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: '3' } } as never);
    const { webClient, moveCard } = makeWebClient();

    await playCardViaTableRow({ ...baseArgs, webClient, sourcePlayerId: 2, judgeTargetId: 2 });

    expect(moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 2,
        targetPlayerId: 2,
        targetZone: ZoneName.STACK,
      }),
      2,
    );
  });
});

describe('autoPlayCard — "Play all nonlands onto the stack"', () => {
  it.each([
    ['0', true, ZoneName.TABLE],
    ['1', true, ZoneName.STACK],
    ['2', true, ZoneName.STACK],
    ['3', true, ZoneName.STACK],
    ['0', false, ZoneName.TABLE],
    ['1', false, ZoneName.TABLE],
    ['2', false, ZoneName.TABLE],
    ['3', false, ZoneName.STACK],
  ])('tablerow %s from hand with playToStack=%s goes to %s, as desktop PlayerActions::playCard', async (tablerow, playToStack, zone) => {
    vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: tablerow } } as never);
    const { webClient, moveCard } = makeWebClient();

    await expect(autoPlayCard({ ...baseArgs, webClient, sourcePlayerId: 1, playToStack })).resolves.toBe(zone);

    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ targetZone: zone, x: -1 }), undefined);
  });

  it('defaults to playing nonlands onto the stack', async () => {
    vi.mocked(CardDTO.get).mockResolvedValue({ tablerow: { value: '1' } } as never);
    const { webClient } = makeWebClient();

    await expect(autoPlayCard({ ...baseArgs, webClient, sourcePlayerId: 1 })).resolves.toBe(ZoneName.STACK);
  });
});

describe('playCardViaTableRow — row placement (card-database policy)', () => {
  it.each([
    ['0', false, ZoneName.TABLE, 2],
    ['0', true, ZoneName.TABLE, 0],
    ['1', false, ZoneName.TABLE, 1],
    ['1', true, ZoneName.TABLE, 1],
    ['2', false, ZoneName.TABLE, 0],
    ['2', true, ZoneName.TABLE, 2],
    ['3', true, ZoneName.STACK, 0],
    ['9', false, ZoneName.TABLE, 1],
    ['x', true, ZoneName.TABLE, 1],
    [undefined, false, ZoneName.TABLE, 1],
  ])('tablerow %j (inverted: %s) plays to %s row %i', async (raw, isInverted, zone, y) => {
    vi.mocked(CardDTO.get).mockResolvedValue((raw === undefined ? undefined : { tablerow: { value: raw } }) as never);
    const { webClient, moveCard } = makeWebClient();

    await playCardViaTableRow({ ...baseArgs, isInverted, webClient, sourcePlayerId: 1 });

    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ targetZone: zone, x: -1, y }), undefined);
  });
});

describe('playCardViaTableRow / autoPlayCard — the played card\'s fields', () => {
  const cardsToMove = (moveCard: ReturnType<typeof vi.fn>) => moveCard.mock.calls[0][1].cardsToMove;

  it('lands on the battlefield with the printed P/T, tapped when cipt', async () => {
    vi.mocked(CardDTO.get).mockResolvedValue({
      tablerow: { value: '0' },
      cipt: { value: '1' },
      prop: { value: { pt: { value: '0/3' } } },
    } as never);
    const { webClient, moveCard } = makeWebClient();

    await autoPlayCard({ ...baseArgs, webClient, sourcePlayerId: 1 });

    expect(cardsToMove(moveCard)).toEqual({ card: [{ cardId: 7, faceDown: false, pt: '0/3', tapped: true }] });
  });

  it('reads only the pt property, as desktop CardInfo::getPowTough, and sends no P/T face down or onto the stack', async () => {
    vi.mocked(CardDTO.get).mockResolvedValueOnce({
      tablerow: { value: '1' },
      prop: { value: { power: { value: '2' }, toughness: { value: '2' } } },
    } as never);
    const split = makeWebClient();
    await playCardViaTableRow({ ...baseArgs, webClient: split.webClient, sourcePlayerId: 1 });
    expect(cardsToMove(split.moveCard)).toEqual({ card: [{ cardId: 7, faceDown: false }] });

    vi.mocked(CardDTO.get).mockResolvedValue({
      tablerow: { value: '1' },
      prop: { value: { pt: { value: '2/2' } } },
    } as never);
    const table = makeWebClient();
    await playCardViaTableRow({ ...baseArgs, webClient: table.webClient, sourcePlayerId: 1 });
    expect(cardsToMove(table.moveCard)).toEqual({ card: [{ cardId: 7, faceDown: false, pt: '2/2' }] });

    const faceDown = makeWebClient();
    await playCardViaTableRow({ ...baseArgs, webClient: faceDown.webClient, sourcePlayerId: 1, faceDown: true });
    expect(cardsToMove(faceDown.moveCard)).toEqual({ card: [{ cardId: 7, faceDown: true }] });

    const stack = makeWebClient();
    await autoPlayCard({ ...baseArgs, webClient: stack.webClient, sourcePlayerId: 1 });
    expect(stack.moveCard.mock.calls[0][1]).toMatchObject({ targetZone: ZoneName.STACK });
    expect(cardsToMove(stack.moveCard)).toEqual({ card: [{ cardId: 7, faceDown: false }] });
  });
});
