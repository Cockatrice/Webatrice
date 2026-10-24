import { fireEvent, render, screen, within } from '@testing-library/react';

import { Language, LanguageNative } from '@app/types';
import LanguageDropdown from './LanguageDropdown';

const mockChoose = vi.fn();

vi.mock('@app/hooks', () => ({
  useLanguagePreference: () => ({ current: Language.en_US, choose: mockChoose }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LanguageDropdown', () => {
  const open = () => fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Common.languagePicker' }));

  test('offers every shipped catalogue under its native name', () => {
    render(<LanguageDropdown />);
    open();

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(Object.values(Language).length);
    for (const language of Object.values(Language)) {
      expect(screen.getByRole('option', { name: new RegExp(LanguageNative[language]) })).toBeInTheDocument();
    }
  });

  test('persists the picked language', () => {
    render(<LanguageDropdown />);
    open();

    fireEvent.click(screen.getByRole('option', { name: /Polski/ }));

    expect(mockChoose).toHaveBeenCalledWith(Language.pl);
  });

  test('does nothing when the current language is picked again', () => {
    render(<LanguageDropdown />);
    open();

    fireEvent.click(screen.getByRole('option', { name: /English - US/ }));

    expect(mockChoose).not.toHaveBeenCalled();
  });
});
