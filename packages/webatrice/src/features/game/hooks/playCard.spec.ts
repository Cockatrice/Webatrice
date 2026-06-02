import { describe, expect, it, vi } from 'vitest';

import { Enriched } from '@cockatrice/datatrice';

import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { playCardViaTableRow } from './playCard';

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(() => Promise.resolve(undefined)) },
}));

function makeWebClient() {
  const moveCard = vi.fn();
  return { webClient: { request: { game: { moveCard } } } as never, moveCard };
}

const baseArgs = {
  gameId: 1,
  sourceZone: Enriched.ZoneName.HAND,
  card: { id: 7, name: 'Bear' } as never,
  faceDown: false,
  isInverted: false,
  tableZone: undefined,
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
        targetZone: Enriched.ZoneName.TABLE,
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
        targetZone: Enriched.ZoneName.TABLE,
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
        targetZone: Enriched.ZoneName.STACK,
      }),
      2,
    );
  });
});
