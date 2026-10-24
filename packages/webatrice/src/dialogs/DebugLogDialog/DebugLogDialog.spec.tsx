import { act, fireEvent, render, screen } from '@testing-library/react';

import { debugLog } from '@app/services';
import { makeSettingsHook } from '../../hooks/__mocks__/useSettings';
import { usePreferences, useSettings } from '../../hooks/useSettings';
import { PREFERENCE_DEFAULTS } from '@app/types';
import DebugLogDialog from './DebugLogDialog';

vi.mock('../../hooks/useSettings');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const clearOnClose = (value: boolean) => {
  vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, clearDebugLogOnClose: value });
};

describe('DebugLogDialog', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    debugLog.setHeader(['Client: webatrice test', '---']);
    debugLog.clear();
    debugLog.append('warn', 'socket closed');
    clearOnClose(false);
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  const log = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'DebugLogDialog.logLabel' });

  test('shows the header and the buffered log, and follows new lines', async () => {
    render(<DebugLogDialog isOpen onClose={vi.fn()} />);

    expect(log().value).toMatch(/^Client: webatrice test\n---\n\[[\d:.]+\] WARN {2}socket closed$/);
    expect(log()).toHaveAttribute('readonly');

    await act(async () => debugLog.append('error', 'later'));
    expect(log().value).toMatch(/ERROR later$/);
  });

  test('copies the whole log to the clipboard', async () => {
    render(<DebugLogDialog isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DebugLogDialog\.copy/ }));
    });

    expect(writeText).toHaveBeenCalledWith(debugLog.toText());
    expect(screen.getByRole('status')).toHaveTextContent('DebugLogDialog.copied');
  });

  test('says so when the browser blocks the clipboard', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<DebugLogDialog isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DebugLogDialog\.copy/ }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('DebugLogDialog.copyFailed');
  });

  test('clears the log on demand, keeping the header', async () => {
    render(<DebugLogDialog isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DebugLogDialog\.clear$/ }));
    });

    expect(log().value).toBe('Client: webatrice test\n---');
  });

  test('keeps the log on close unless "Clear log when closing" is on', () => {
    const onClose = vi.fn();
    const { rerender } = render(<DebugLogDialog isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Common.action.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(debugLog.getEntries()).toHaveLength(1);

    clearOnClose(true);
    rerender(<DebugLogDialog isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.close' }));

    expect(debugLog.getEntries()).toHaveLength(0);
  });

  test('holds no log subscription while closed', () => {
    const subscribe = vi.spyOn(debugLog, 'subscribe');
    const { rerender } = render(<DebugLogDialog isOpen={false} onClose={vi.fn()} />);

    expect(subscribe).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<DebugLogDialog isOpen onClose={vi.fn()} />);
    expect(subscribe).toHaveBeenCalled();
    subscribe.mockRestore();
  });

  test('persists the "Clear log when closing" choice', () => {
    const hook = makeSettingsHook();
    vi.mocked(useSettings).mockReturnValue(hook);
    render(<DebugLogDialog isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'DebugLogDialog.clearOnClose' }));

    expect(hook.update).toHaveBeenCalledWith({ clearDebugLogOnClose: true });
  });
});
