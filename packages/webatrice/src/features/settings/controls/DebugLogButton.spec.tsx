import { fireEvent, render, screen } from '@testing-library/react';

import DebugLogButton from './DebugLogButton';

vi.mock('@app/dialogs', () => ({
  DebugLogDialog: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div role="dialog"><button onClick={onClose}>close</button></div> : null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DebugLogButton', () => {
  test('opens and closes the debug log dialog', () => {
    render(<DebugLogButton id="debugLog" labelId="debugLog-label" disabled={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /SettingsGeneral\.debugLog\.button/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
