import { act, renderHook, waitFor } from '@testing-library/react';

import { DEFAULT_PICTURE_URL_TEMPLATES } from '@app/services';

const hoisted = vi.hoisted(() => ({ getPictureUrlTemplates: vi.fn(), savePictureUrlTemplates: vi.fn() }));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  cardDatabaseService: hoisted,
}));

import { usePictureUrlTemplates } from './usePictureUrlTemplates';

async function renderLoaded(templates = ['https://a/!name!', 'https://b/!name!']) {
  hoisted.getPictureUrlTemplates.mockResolvedValue(templates);
  hoisted.savePictureUrlTemplates.mockResolvedValue(undefined);
  const hook = renderHook(() => usePictureUrlTemplates());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('usePictureUrlTemplates', () => {
  it('adds a template at the end and stores the list', async () => {
    const { result } = await renderLoaded();
    await act(async () => {
      await result.current.add(' https://c/!name! ');
    });
    expect(result.current.templates).toEqual(['https://a/!name!', 'https://b/!name!', 'https://c/!name!']);
    expect(hoisted.savePictureUrlTemplates).toHaveBeenCalledWith(result.current.templates);
    expect(result.current.selectedIndex).toBe(2);
  });

  it('reorders, edits and removes the selected template', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.select(1));

    await act(async () => {
      await result.current.moveSelected(-1);
    });
    expect(result.current.templates).toEqual(['https://b/!name!', 'https://a/!name!']);
    expect(result.current.selectedIndex).toBe(0);

    await act(async () => {
      await result.current.moveSelected(-1);
    });
    expect(result.current.templates[0]).toBe('https://b/!name!');

    await act(async () => {
      await result.current.replaceSelected('https://z/!name!');
    });
    expect(result.current.templates).toEqual(['https://z/!name!', 'https://a/!name!']);

    await act(async () => {
      await result.current.removeSelected();
    });
    expect(result.current.templates).toEqual(['https://a/!name!']);
    expect(result.current.selectedIndex).toBeNull();
  });

  it('resets to desktop\'s defaults', async () => {
    const { result } = await renderLoaded(['https://x']);
    await act(async () => {
      await result.current.resetToDefaults();
    });
    expect(result.current.templates).toEqual(DEFAULT_PICTURE_URL_TEMPLATES);
  });

  it('keeps the previous list when storing fails', async () => {
    const { result } = await renderLoaded();
    hoisted.savePictureUrlTemplates.mockRejectedValue(new Error('quota'));
    await act(async () => {
      await result.current.add('https://c');
    });
    expect(result.current.templates).toHaveLength(2);
    expect(result.current.error).toEqual({ key: 'save', detail: 'quota' });
  });
});
