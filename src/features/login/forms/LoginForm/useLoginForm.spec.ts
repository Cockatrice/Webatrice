import { act, renderHook } from '@testing-library/react';

vi.mock('@app/hooks', async (orig) => {
  const actual = await orig<typeof import('@app/hooks')>();
  return { ...actual, useSettings: vi.fn() };
});
vi.mock('@app/feature-widgets/known-hosts');

import { useSettings, LoadingState } from '@app/hooks';
import { useKnownHosts } from '@app/feature-widgets/known-hosts';

import {
  makeHost,
  makeKnownHostsHook,
} from '../../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';
import {
  makeSettings,
  makeSettingsHook,
} from '../../../../hooks/__mocks__/useSettings';
import { useLoginFormBody } from './useLoginForm';

interface FormState {
  userName: string;
  password: string;
  remember: boolean;
  autoConnect: boolean;
}

function setup({
  host = makeHost(),
  initial = {
    userName: '',
    password: '',
    remember: false,
    autoConnect: false,
  } as FormState,
  settings = makeSettingsHook({ value: makeSettings() }),
}: {
  host?: ReturnType<typeof makeHost>;
  initial?: FormState;
  settings?: ReturnType<typeof makeSettingsHook>;
} = {}) {
  vi.mocked(useSettings).mockReturnValue(settings);
  vi.mocked(useKnownHosts).mockReturnValue(
    makeKnownHostsHook({ value: { hosts: [host], selectedHost: host } as any }),
  );

  const form: FormState = { ...initial };
  const setValue = vi.fn((field: keyof FormState, value: any) => {
    form[field] = value;
  });
  const getValues = vi.fn(() => ({ ...form }));

  const { result } = renderHook(() =>
    useLoginFormBody({ setValue: setValue as any, getValues: getValues as any }),
  );
  return { result, setValue, getValues, form, settings };
}

describe('useLoginFormBody', () => {
  it('initial state mirrors the selected host', () => {
    const host = makeHost({ id: 1 });
    const { result } = setup({ host });
    expect(result.current.selectedHost).toBe(host);
    expect(result.current.useStoredPasswordLabel).toBe(false);
  });

  it('onSelectedHostChange seeds form fields and clears password', () => {
    const { result, setValue } = setup();
    const next = makeHost({
      id: 9,
      userName: 'alice',
      remember: true,
      hashedPassword: 'hash',
      supportsHashedPassword: true,
    } as any);

    act(() => {
      result.current.onSelectedHostChange(next as any);
    });

    expect(setValue).toHaveBeenCalledWith('userName', 'alice');
    expect(setValue).toHaveBeenCalledWith('password', '');
    expect(setValue).toHaveBeenCalledWith('remember', true);
  });

  it('onSelectedHostChange to a naked server forces autoConnect off and persists when needed', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const { result, setValue } = setup({
      settings: makeSettingsHook({
        value: makeSettings({ autoConnect: true }),
        update,
      }),
    });
    const naked = makeHost({ supportsHashedPassword: false } as any);

    act(() => {
      result.current.onSelectedHostChange(naked as any);
    });

    expect(setValue).toHaveBeenCalledWith('autoConnect', false);
    expect(setValue).toHaveBeenCalledWith('remember', false);
    expect(update).toHaveBeenCalledWith({ autoConnect: false });
  });

  it('onUserToggleAutoConnect persists the new value and forces remember on', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const { result, setValue } = setup({
      settings: makeSettingsHook({ value: makeSettings(), update }),
    });
    const fieldOnChange = vi.fn();

    act(() => {
      result.current.onUserToggleAutoConnect(true, fieldOnChange);
    });

    expect(fieldOnChange).toHaveBeenCalledWith(true);
    expect(update).toHaveBeenCalledWith({ autoConnect: true });
    expect(setValue).toHaveBeenCalledWith('remember', true);
  });

  it('onRememberChange clears autoConnect when remember is turned off', () => {
    const { result, setValue } = setup({
      initial: {
        userName: '',
        password: '',
        remember: true,
        autoConnect: true,
      },
    });

    act(() => {
      result.current.onRememberChange(false);
    });

    expect(setValue).toHaveBeenCalledWith('autoConnect', false);
  });

  it('onUserToggleAutoConnect is a no-op for the settings store when still loading', () => {
    const update = vi.fn();
    const { result } = setup({
      settings: { status: LoadingState.LOADING, update } as any,
    });

    act(() => {
      result.current.onUserToggleAutoConnect(true, vi.fn());
    });

    expect(update).not.toHaveBeenCalled();
  });
});
