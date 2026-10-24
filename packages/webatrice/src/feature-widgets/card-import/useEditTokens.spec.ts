import { act, renderHook, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getCustomTokens: vi.fn(),
  saveCustomTokens: vi.fn(),
  isNameTaken: vi.fn(),
}));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  cardDatabaseService: hoisted,
}));

import { createCustomToken } from './customTokens';
import { useEditTokens } from './useEditTokens';

async function renderLoaded(names: string[] = ['Spirit']) {
  hoisted.getCustomTokens.mockResolvedValue(names.map(createCustomToken));
  let stored = names.map(createCustomToken);
  hoisted.saveCustomTokens.mockImplementation(async (changed, removed) => {
    stored = [
      ...stored.filter(token => !removed.includes(token.name.value) && !changed.some(item => item.name.value === token.name.value)),
      ...changed,
    ];
    return stored;
  });
  hoisted.isNameTaken.mockResolvedValue(false);
  const hook = renderHook(() => useEditTokens());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useEditTokens', () => {
  it('adds a token, persists it and selects it', async () => {
    const { result } = await renderLoaded();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.addToken(' Angel ');
    });

    expect(outcome).toBe('added');
    expect(result.current.tokens.map((t) => t.name.value)).toEqual(['Angel', 'Spirit']);
    expect(result.current.selected?.name.value).toBe('Angel');
    expect(hoisted.saveCustomTokens).toHaveBeenCalledWith([createCustomToken('Angel')], [], 'add');
  });

  it('refuses names used by another card, token or custom token', async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      expect(await result.current.addToken('spirit')).toBe('conflict');
    });
    hoisted.isNameTaken.mockResolvedValue(true);
    await act(async () => {
      expect(await result.current.addToken('Lightning Bolt')).toBe('conflict');
    });
    expect(hoisted.saveCustomTokens).not.toHaveBeenCalled();
  });

  it('updates and removes the selected token', async () => {
    const { result } = await renderLoaded(['Spirit', 'Zombie']);
    act(() => result.current.select('Zombie'));

    await act(async () => {
      await result.current.updateSelected({ color: 'b', pt: '2/2', annotation: 'Decayed' });
    });
    expect(result.current.selected?.prop?.value.pt).toEqual({ value: '2/2' });
    expect(hoisted.saveCustomTokens).toHaveBeenLastCalledWith([result.current.selected], [], 'update');

    await act(async () => {
      await result.current.removeSelected();
    });
    expect(result.current.tokens.map((t) => t.name.value)).toEqual(['Spirit']);
    expect(hoisted.saveCustomTokens).toHaveBeenLastCalledWith([], ['Zombie'], 'upsert');
  });

  it('does not mutate tokens while the source is loading', async () => {
    hoisted.getCustomTokens.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEditTokens());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await expect(result.current.addToken('Angel')).rejects.toThrow('loading');
    });
    expect(hoisted.saveCustomTokens).not.toHaveBeenCalled();
  });

  it('exports the tokens as Cockatrice XML', async () => {
    const { result } = await renderLoaded();
    expect(result.current.exportXml()).toContain('<name>Spirit</name>');
  });

  it('keeps the old list and reports when saving fails', async () => {
    const { result } = await renderLoaded();
    hoisted.saveCustomTokens.mockRejectedValue(new Error('quota'));

    await act(async () => {
      await result.current.addToken('Angel').catch(() => undefined);
    });
    expect(result.current.tokens.map((t) => t.name.value)).toEqual(['Spirit']);
    expect(result.current.error).toEqual({ key: 'save', detail: 'quota' });
  });
});
