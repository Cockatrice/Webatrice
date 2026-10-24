import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { dexieService } from '@app/services';

import { cardDatabaseService } from '../../../../src/services/cardDatabase/CardDatabaseService';
import { createCustomToken } from '../../../../src/feature-widgets/card-import/customTokens';
import { useEditTokens } from '../../../../src/feature-widgets/card-import/useEditTokens';

const xml = (name: string) => `<cockatrice_carddatabase version="4"><cards>
  <card><name>${name}</name><set>CUBE</set></card></cards></cockatrice_carddatabase>`;

beforeEach(async () => {
  vi.useRealTimers();
  await Promise.all([
    dexieService.cards.clear(), dexieService.tokens.clear(), dexieService.sets.clear(),
    dexieService.formats.clear(), dexieService.info.clear(), dexieService.cardSources.clear(),
    dexieService.cardSourcePayloads.clear(), dexieService.setPreferences.clear(), dexieService.cardDataSettings.clear(),
  ]);
});

describe('card data preservation (real Dexie)', () => {
  it.each([
    '<html/>',
    '<cockatrice_carddatabase version="2"><cards/></cockatrice_carddatabase>',
    '<cockatrice_carddatabase><cards/></cockatrice_carddatabase>',
    '<cockatrice_carddatabase version="4"><sets><set><name/></set></sets></cockatrice_carddatabase>',
  ])('rejects invalid replacement XML without changing the source or its tables: %s', async (invalid) => {
    await cardDatabaseService.addSources([{ fileName: 'cards.xml', xml: xml('Kept'), origin: 'file' }]);
    const source = await dexieService.cardSources.get('main');
    const payload = await dexieService.cardSourcePayloads.get('main');
    const cards = await dexieService.cards.toArray();
    const sets = await dexieService.sets.toArray();

    await expect(cardDatabaseService.addSources([{ fileName: 'cards.xml', xml: invalid, origin: 'file' }])).rejects.toThrow();

    expect(await dexieService.cardSources.get('main')).toEqual(source);
    expect(await dexieService.cardSourcePayloads.get('main')).toEqual(payload);
    expect(await dexieService.cards.toArray()).toEqual(cards);
    expect(await dexieService.sets.toArray()).toEqual(sets);
    await cardDatabaseService.reload();
    expect(await dexieService.cards.toArray()).toEqual(cards);
  });

  it('skips an unnamed card without discarding the valid replacement records', async () => {
    await cardDatabaseService.addSources([{ fileName: 'cards.xml', xml: xml('Old'), origin: 'file' }]);
    await cardDatabaseService.addSources([{ fileName: 'cards.xml', origin: 'file', xml:
      '<cockatrice_carddatabase version="4"><cards><card><text>Missing name</text></card>'
      + '<card><name>Kept</name><set>CUBE</set></card></cards></cockatrice_carddatabase>',
    }]);
    expect((await dexieService.cards.toArray()).map(card => card.name.value)).toEqual(['Kept']);
  });

  it('preserves both concurrent token additions and edits through reload', async () => {
    const spirit = createCustomToken('Spirit');
    const angel = createCustomToken('Angel');
    await Promise.all([
      cardDatabaseService.saveCustomTokens([spirit]),
      cardDatabaseService.saveCustomTokens([angel]),
    ]);
    const editedSpirit = { ...spirit, text: { value: 'Flying' } };
    const editedAngel = { ...angel, text: { value: 'Vigilance' } };
    await Promise.all([
      cardDatabaseService.saveCustomTokens([editedSpirit]),
      cardDatabaseService.saveCustomTokens([editedAngel]),
    ]);
    expect(await cardDatabaseService.getCustomTokens()).toEqual(expect.arrayContaining([editedSpirit, editedAngel]));
    await cardDatabaseService.reload();
    expect(await dexieService.tokens.toArray()).toEqual([editedAngel, editedSpirit]);

    await Promise.all([
      cardDatabaseService.saveCustomTokens([], ['Spirit']),
      cardDatabaseService.saveCustomTokens([{ ...editedAngel, text: { value: 'Updated' } }]),
    ]);
    await cardDatabaseService.reload();
    expect(await dexieService.tokens.toArray()).toEqual([{ ...editedAngel, text: { value: 'Updated' } }]);
  });

  it('allocates distinct source identities for concurrent same-named custom imports', async () => {
    await Promise.all([
      cardDatabaseService.addSources([{ fileName: 'cube.xml', xml: xml('First'), origin: 'file' }]),
      cardDatabaseService.addSources([{ fileName: 'cube.xml', xml: xml('Second'), origin: 'file' }]),
    ]);
    expect((await cardDatabaseService.listSources()).map((source) => source.id)).toEqual(['custom:01:cube.xml', 'custom:02:cube.xml']);
    await cardDatabaseService.reload();
    expect((await dexieService.cards.toArray()).map((card) => card.name.value)).toEqual(['First', 'Second']);
  });

  it('checks new-token names in the same transaction as the insert', async () => {
    const results = await Promise.allSettled([
      cardDatabaseService.saveCustomTokens([createCustomToken('Spirit')], [], 'add'),
      cardDatabaseService.saveCustomTokens([createCustomToken('spirit')], [], 'add'),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await cardDatabaseService.getCustomTokens()).toHaveLength(1);
  });

  it('preserves concurrent edits from two editors holding the same old snapshot', async () => {
    await cardDatabaseService.saveCustomTokens([createCustomToken('Spirit'), createCustomToken('Angel')]);
    const first = renderHook(() => useEditTokens());
    const second = renderHook(() => useEditTokens());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });
    act(() => {
      first.result.current.select('Spirit');
      second.result.current.select('Angel');
    });
    await act(async () => {
      await Promise.all([
        first.result.current.updateSelected({ color: 'w', pt: '1/1', annotation: 'Flying' }),
        second.result.current.updateSelected({ color: 'w', pt: '4/4', annotation: 'Vigilance' }),
      ]);
    });
    await cardDatabaseService.reload();
    expect((await dexieService.tokens.get('Spirit')).text.value).toBe('Flying');
    expect((await dexieService.tokens.get('Angel')).text.value).toBe('Vigilance');
    first.unmount();
    second.unmount();
  });
});
