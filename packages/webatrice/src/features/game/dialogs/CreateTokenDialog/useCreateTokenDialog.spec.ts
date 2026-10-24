import { act, renderHook, waitFor } from '@testing-library/react';

import { CREATE_TOKEN_DEFAULT_COLOR, useCreateTokenDialog } from './useCreateTokenDialog';

const hoisted = vi.hoisted(() => ({
  toArray: vi.fn(() => Promise.resolve([])),
  annotateTokens: false,
  overrides: {} as Record<string, string>,
}));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  useCardOverride: (name: string) => ({ pinnedPrintingId: hoisted.overrides[name] }),
  usePreference: (key: string) => (key === 'annotateTokens' ? hoisted.annotateTokens : undefined),
}));

vi.mock('@app/services', () => ({
  dexieService: { tokens: { toArray: hoisted.toArray } },
}));

describe('useCreateTokenDialog', () => {
  beforeEach(() => {
    hoisted.toArray.mockReset();
    hoisted.toArray.mockResolvedValue([]);
    hoisted.annotateTokens = false;
    hoisted.overrides = {};
  });

  it.each(['valid-pin', 'stale-pin'])('sends the exact %s for manual and predefined tokens', (providerId) => {
    hoisted.overrides = { Soldier: providerId };
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, onSubmit }));
    act(() => result.current.handleNameChange('Soldier'));
    act(() => result.current.handleSubmit());
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Soldier', providerId }));

    act(() => result.current.selectPredefinedToken({ name: { value: 'Soldier' }, set: [{ value: 'SET', uuid: 'other' }] } as never));
    act(() => result.current.handleSubmit());
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Soldier', providerId }));
  });

  it('sends no provider id without an exact-name pin', () => {
    hoisted.overrides = { Soldier: 'pin' };
    const onSubmit = vi.fn();
    const initial = {
      name: 'soldier', color: 'w', pt: '1/1', annotation: '', destroyOnZoneChange: true, faceDown: false, providerId: 'old',
    };
    const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, initial, onSubmit }));
    act(() => result.current.handleSubmit());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ providerId: '' }));
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

  it('opens on the given token but derives its provider only from the current pin', () => {
    const onSubmit = vi.fn();
    const initial = {
      name: 'Soldier', color: 'w', pt: '1/1', annotation: 'x', destroyOnZoneChange: false, faceDown: false, providerId: 'abc',
    };
    const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, onSubmit, initial }));

    expect(result.current).toMatchObject({ name: 'Soldier', pt: '1/1', annotation: 'x', destroyOnZoneChange: false });
    act(() => result.current.handleSubmit());
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ providerId: '' }));

    act(() => result.current.handleNameChange('Knight'));
    act(() => result.current.handleSubmit());
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ providerId: '' }));
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
    expect(result.current.error).toBe('CreateTokenDialog.validation.nameRequired');
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
      providerId: '',
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

  describe('picking a token from the database', () => {
    const treasure = {
      name: { value: 'Treasure' },
      text: { value: 'Sacrifice this artifact: Add one mana of any color.' },
      prop: { value: { pt: { value: '' } } },
    };

    it('fills in its rules text as the annotation with "Annotate card text on tokens" on', () => {
      hoisted.annotateTokens = true;
      const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, onSubmit: vi.fn() }));
      act(() => result.current.selectPredefinedToken(treasure as never));
      expect(result.current.annotation).toBe('Sacrifice this artifact: Add one mana of any color.');
    });

    it('leaves the annotation alone with the option off, as desktop does', () => {
      const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, onSubmit: vi.fn() }));
      act(() => result.current.setAnnotation('mine'));
      act(() => result.current.selectPredefinedToken(treasure as never));
      expect(result.current.annotation).toBe('mine');
    });

    it.each(['M', 'm', 'WU'])('recognizes the literal %s color code as multicolor', (colorCode) => {
      const token = {
        ...treasure,
        prop: { value: { colors: { value: colorCode }, pt: { value: '' } } },
      };
      const { result } = renderHook(() => useCreateTokenDialog({ isOpen: true, onSubmit: vi.fn() }));

      act(() => result.current.selectPredefinedToken(token as never));

      expect(result.current.color).toBe('m');
    });
  });
});
