import { act, renderHook } from '@testing-library/react';

import { usePromptDialog } from './usePromptDialog';

describe('usePromptDialog', () => {
  it('seeds value from initialValue and starts with no error', () => {
    const { result } = renderHook(() =>
      usePromptDialog({
        isOpen: true,
        initialValue: 'seed',
        onSubmit: vi.fn(),
      }),
    );

    expect(result.current.value).toBe('seed');
    expect(result.current.error).toBeNull();
  });

  it('handleChange updates value and clears existing error', () => {
    const validate = (v: string) => (v === '' ? 'required' : null);
    const { result } = renderHook(() =>
      usePromptDialog({
        isOpen: true,
        initialValue: '',
        validate,
        onSubmit: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleSubmit();
    });
    expect(result.current.error).toBe('required');

    act(() => {
      result.current.handleChange('typed');
    });
    expect(result.current.value).toBe('typed');
    expect(result.current.error).toBeNull();
  });

  it('handleSubmit forwards the current value when validation passes', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      usePromptDialog({
        isOpen: true,
        initialValue: '7',
        onSubmit,
      }),
    );

    act(() => {
      result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith('7');
  });

  it('handleSubmit blocks the submit and surfaces the validator error', () => {
    const onSubmit = vi.fn();
    const validate = (v: string) => (v === '' ? 'required' : null);
    const { result } = renderHook(() =>
      usePromptDialog({
        isOpen: true,
        initialValue: '',
        validate,
        onSubmit,
      }),
    );

    act(() => {
      result.current.handleSubmit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('required');
  });

  it('resets value and clears error when reopened with a new initialValue', () => {
    const { result, rerender } = renderHook(
      ({ isOpen, initialValue }: { isOpen: boolean; initialValue: string }) =>
        usePromptDialog({ isOpen, initialValue, onSubmit: vi.fn() }),
      { initialProps: { isOpen: false, initialValue: 'old' } },
    );

    rerender({ isOpen: true, initialValue: 'new' });

    expect(result.current.value).toBe('new');
    expect(result.current.error).toBeNull();
  });
});
