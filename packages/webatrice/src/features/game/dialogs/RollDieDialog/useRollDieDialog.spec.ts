import { act, renderHook } from '@testing-library/react';

import { useRollDieDialog } from './useRollDieDialog';

describe('useRollDieDialog', () => {
  it('seeds sides and count from the lastSides/lastCount arguments', () => {
    const { result } = renderHook(() =>
      useRollDieDialog({ isOpen: true, lastSides: 20, lastCount: 4, onSubmit: vi.fn() }),
    );

    expect(result.current.sides).toBe('20');
    expect(result.current.count).toBe('4');
    expect(result.current.error).toBeNull();
  });

  it('resets the form when the dialog re-opens with new defaults', () => {
    const { result, rerender } = renderHook(
      ({ isOpen, lastSides, lastCount }) =>
        useRollDieDialog({ isOpen, lastSides, lastCount, onSubmit: vi.fn() }),
      { initialProps: { isOpen: false, lastSides: 6, lastCount: 1 } },
    );

    act(() => result.current.handleSidesChange('99'));
    expect(result.current.sides).toBe('99');

    rerender({ isOpen: true, lastSides: 12, lastCount: 3 });

    expect(result.current.sides).toBe('12');
    expect(result.current.count).toBe('3');
  });

  it('invokes onSubmit with parsed numeric values on a valid submit', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useRollDieDialog({ isOpen: true, lastSides: 6, lastCount: 1, onSubmit }),
    );

    act(() => result.current.handleSidesChange('20'));
    act(() => result.current.handleCountChange('2'));
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledWith({ sides: 20, count: 2 });
  });

  it('flags an invalid sides input and does not call onSubmit', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useRollDieDialog({ isOpen: true, lastSides: 6, lastCount: 1, onSubmit }),
    );

    act(() => result.current.handleSidesChange('0'));
    act(() => result.current.handleSubmit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toEqual({ field: 'sides', message: expect.any(String) });
  });

  it('clears a stale error when the user edits the field again', () => {
    const { result } = renderHook(() =>
      useRollDieDialog({ isOpen: true, lastSides: 6, lastCount: 1, onSubmit: vi.fn() }),
    );

    act(() => result.current.handleCountChange('-1'));
    act(() => result.current.handleSubmit());
    expect(result.current.error?.field).toBe('count');

    act(() => result.current.handleCountChange('3'));
    expect(result.current.error).toBeNull();
  });
});
