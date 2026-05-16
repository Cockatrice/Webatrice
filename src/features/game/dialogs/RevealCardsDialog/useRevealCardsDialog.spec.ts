import { act, renderHook } from '@testing-library/react';

import { useRevealCardsDialog } from './useRevealCardsDialog';

describe('useRevealCardsDialog', () => {
  it('defaults the target to -1 (all players) and seeds countDraft from defaultCount', () => {
    const { result } = renderHook(() =>
      useRevealCardsDialog({
        isOpen: true,
        showCountInput: true,
        defaultCount: 3,
        onSubmit: vi.fn(),
      }),
    );

    expect(result.current.targetPlayerId).toBe(-1);
    expect(result.current.countDraft).toBe('3');
    expect(result.current.error).toBeNull();
  });

  it('resets local state when the dialog re-opens', () => {
    const { result, rerender } = renderHook(
      ({ isOpen, defaultCount }) =>
        useRevealCardsDialog({ isOpen, showCountInput: true, defaultCount, onSubmit: vi.fn() }),
      { initialProps: { isOpen: false, defaultCount: 3 } },
    );

    act(() => result.current.setTargetPlayerId(7));
    act(() => result.current.handleCountChange('99'));

    rerender({ isOpen: true, defaultCount: 5 });

    expect(result.current.targetPlayerId).toBe(-1);
    expect(result.current.countDraft).toBe('5');
  });

  it('submits the chosen target with topCards=-1 when showCountInput is false', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useRevealCardsDialog({
        isOpen: true,
        showCountInput: false,
        defaultCount: 1,
        onSubmit,
      }),
    );

    act(() => result.current.setTargetPlayerId(2));
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledWith({ targetPlayerId: 2, topCards: -1 });
  });

  it('submits the parsed integer when showCountInput is true and the value is valid', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useRevealCardsDialog({
        isOpen: true,
        showCountInput: true,
        defaultCount: 1,
        onSubmit,
      }),
    );

    act(() => result.current.handleCountChange('4'));
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledWith({ targetPlayerId: -1, topCards: 4 });
  });

  it('rejects a non-positive countDraft and surfaces an error without calling onSubmit', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useRevealCardsDialog({
        isOpen: true,
        showCountInput: true,
        defaultCount: 1,
        onSubmit,
      }),
    );

    act(() => result.current.handleCountChange('0'));
    act(() => result.current.handleSubmit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/positive integer/i);
  });
});
