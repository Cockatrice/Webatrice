import { act, renderHook, waitFor } from '@testing-library/react';

import { useCardOverride } from '../../../hooks/useCardOverride';
import { emptyPriceLookup } from '../pricing';
import type { DeckCard } from '../types';
import { useCardPrintings } from './useCardPrintings';
import { usePrintingPicker } from './usePrintingPicker';

vi.mock('./useCardPrintings', () => ({ useCardPrintings: vi.fn() }));
vi.mock('../../../hooks/useCardOverride', () => ({ useCardOverride: vi.fn() }));

it('gives the pin precedence over printings already in the deck', () => {
  vi.mocked(useCardPrintings).mockReturnValue({
    canonicalName: 'Opt', printings: [{ scryfallId: 'deck' }, { scryfallId: 'pin' }],
    prices: emptyPriceLookup(), loading: false, error: null,
  });
  vi.mocked(useCardOverride).mockReturnValue({ pinnedPrintingId: 'pin', savingPin: false, togglePin: vi.fn() });
  const card: DeckCard = { name: 'opt', quantity: 1, category: 'main', scryfallId: 'deck', lookupSource: 'scryfall' };
  const { result } = renderHook(() => usePrintingPicker(card, [card]));
  expect(result.current.printings.map((printing) => printing.scryfallId)).toEqual(['pin', 'deck']);
  expect(useCardOverride).toHaveBeenLastCalledWith('Opt');
});

it('reports a failed preference write without selecting a deck printing', async () => {
  vi.mocked(useCardPrintings).mockReturnValue({
    canonicalName: 'Opt', printings: [{ scryfallId: 'pin' }],
    prices: emptyPriceLookup(), loading: false, error: null,
  });
  vi.mocked(useCardOverride).mockReturnValue({
    pinnedPrintingId: '', savingPin: false, togglePin: vi.fn().mockRejectedValue(new Error('quota')),
  });
  const { result } = renderHook(() => usePrintingPicker({ name: 'Opt', category: 'main', quantity: 1, lookupSource: 'scryfall' }, []));
  act(() => result.current.pin('pin'));
  await waitFor(() => expect(result.current.pinError).toBe('PrintingPicker.pinFailed'));
});
