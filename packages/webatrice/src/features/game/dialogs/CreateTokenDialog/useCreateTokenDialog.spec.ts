import { act, renderHook, waitFor } from '@testing-library/react';

import { CREATE_TOKEN_DEFAULT_COLOR, useCreateTokenDialog } from './useCreateTokenDialog';

const hoisted = vi.hoisted(() => ({
  toArray: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@app/services', () => ({
  dexieService: { tokens: { toArray: hoisted.toArray } },
}));

describe('useCreateTokenDialog', () => {
  beforeEach(() => {
    hoisted.toArray.mockReset();
    hoisted.toArray.mockResolvedValue([]);
  });

  it('seeds default fields and color when the dialog opens', () => {
    const { result } = renderHook(() =>
      useCreateTokenDialog({ isOpen: true, onSubmit: vi.fn() }),
    );

    expect(result.current.name).toBe('');
    expect(result.current.color).toBe(CREATE_TOKEN_DEFAULT_COLOR);
    expect(result.current.destroyOnZoneChange).toBe(true);
    expect(result.current.faceDown).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.scope).toBe('all');
  });

  it('resets the form fields when the dialog is reopened', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useCreateTokenDialog({ isOpen, onSubmit: vi.fn() }),
      { initialProps: { isOpen: true } },
    );

    act(() => result.current.handleNameChange('temp'));
    expect(result.current.name).toBe('temp');

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(result.current.name).toBe('');
  });

  it('starts the chooser in deck scope when predefinedTokenNames are supplied', () => {
    const { result } = renderHook(() =>
      useCreateTokenDialog({
        isOpen: true,
        onSubmit: vi.fn(),
        predefinedTokenNames: ['Soldier'],
      }),
    );

    expect(result.current.scope).toBe('deck');
  });

  it('rejects submission when the name is blank and surfaces an error', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useCreateTokenDialog({ isOpen: true, onSubmit }),
    );

    act(() => result.current.handleSubmit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/name is required/i);
  });

  it('invokes onSubmit with trimmed payload fields on a valid submit', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useCreateTokenDialog({ isOpen: true, onSubmit }),
    );

    act(() => result.current.handleNameChange('  Goblin  '));
    act(() => result.current.setColor('r'));
    act(() => result.current.setPT(' 1/1 '));
    act(() => result.current.setAnnotation(' note '));
    act(() => result.current.setFaceDown(true));
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Goblin',
      color: 'r',
      pt: '1/1',
      annotation: 'note',
      destroyOnZoneChange: true,
      faceDown: true,
    });
  });

  it('loads available tokens from dexieService once when opened and filters by search', async () => {
    hoisted.toArray.mockResolvedValueOnce([
      { name: { value: 'Soldier' } },
      { name: { value: 'Zombie' } },
    ]);

    const { result } = renderHook(() =>
      useCreateTokenDialog({ isOpen: true, onSubmit: vi.fn() }),
    );

    await waitFor(() => {
      expect(result.current.availableTokens).toHaveLength(2);
    });

    act(() => result.current.setSearch('zom'));
    expect(result.current.filteredTokens.map((t) => t.name?.value)).toEqual(['Zombie']);
  });
});
