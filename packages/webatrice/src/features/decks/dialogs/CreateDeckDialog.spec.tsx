import { fireEvent, render, screen } from '@testing-library/react';

import { CreateDeckDialog } from './CreateDeckDialog';

describe('CreateDeckDialog', () => {
  it('renders nothing while closed', () => {
    render(<CreateDeckDialog open={false} onClose={() => {}} onCreate={() => {}} />);
    expect(screen.queryByText('CreateDeckDialog.title')).toBeNull();
  });

  it('is a modal dialog named by its heading', () => {
    render(<CreateDeckDialog open onClose={() => {}} onCreate={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'CreateDeckDialog.title' })).toHaveAttribute('aria-modal', 'true');
  });

  it('submits the trimmed name and lower-cased format on Create or Enter', () => {
    const onCreate = vi.fn();
    render(<CreateDeckDialog open onClose={() => {}} onCreate={onCreate} />);

    const name = screen.getByPlaceholderText('CreateDeckDialog.namePlaceholder');
    fireEvent.change(name, { target: { value: '  Brew ' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pauper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.create' }));
    expect(onCreate).toHaveBeenLastCalledWith('Brew', 'pauper');

    fireEvent.keyDown(name, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it('blocks submit for "Other" with no custom format typed', () => {
    const onCreate = vi.fn();
    render(<CreateDeckDialog open onClose={() => {}} onCreate={onCreate} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } });
    expect(screen.getByRole('button', { name: 'Common.action.create' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('FormatPicker.placeholder.dialog'), { target: { value: 'Cube' } });
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.create' }));
    expect(onCreate).toHaveBeenCalledWith('', 'cube');
  });

  it('closes on Escape, the backdrop, and Cancel', () => {
    const onClose = vi.fn();
    render(<CreateDeckDialog open onClose={onClose} onCreate={() => {}} />);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.cancel' }));
    fireEvent.click(document.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
