import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import { testI18n } from '../../../../__test-utils__/renderWithProviders';
import { makeDialogTestEnv, makeDialogTestGame, makeSetterSpies } from '../../__test-utils__/dialogTestEnv';
import type { PromptState } from './gameDialogs.types';
import { useLibraryDialogActions } from './useLibraryDialogActions';

function setup(deckCount = 40) {
  const { env, webClient } = makeDialogTestEnv(makeDialogTestGame({ deckCount }));
  const set = makeSetterSpies();
  const { result } = renderHook(
    () => useLibraryDialogActions({ env, set }),
    { wrapper: ({ children }) => createElement(I18nextProvider, { i18n: testI18n }, children) },
  );
  const lastPrompt = () => set.setPrompt.mock.calls.at(-1)?.[0] as PromptState;
  return { result, set, webClient, lastPrompt };
}

describe('useLibraryDialogActions', () => {
  it('moves the top N cards as positions N-1..0, clamped to the library', () => {
    const { result, webClient, lastPrompt } = setup(2);

    result.current.handleRequestMoveTopNToZone(ZoneName.GRAVE);
    expect(lastPrompt().title).toBe('Move top cards to graveyard');
    lastPrompt().onSubmit('5');

    expect(webClient.request.game.moveCard).toHaveBeenCalledWith(1, {
      startPlayerId: 1,
      startZone: ZoneName.DECK,
      cardsToMove: { card: [{ cardId: 1 }, { cardId: 0 }] },
      targetPlayerId: 1,
      targetZone: ZoneName.GRAVE,
      x: 0,
      y: 0,
      isReversed: false,
    });
  });

});
