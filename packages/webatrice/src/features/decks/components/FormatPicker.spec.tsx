import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { FormatPicker } from './FormatPicker';

function Harness({ initial, variant = 'dialog' as const, onChange = () => {} }: {
  initial: string;
  variant?: 'dialog' | 'sidebar';
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <FormatPicker
        value={value}
        variant={variant}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
      <output>{value}</output>
    </>
  );
}

describe('FormatPicker', () => {
  it('shows an empty value as Not set and selects a known format', () => {
    render(<Harness initial="" />);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'FormatPicker.unset' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'modern' } });
    expect(screen.getByRole('status')).toHaveTextContent('modern');
  });

  it('opens a custom format in Other mode with its text prefilled', () => {
    render(<Harness initial="Netrunner" />);
    expect(screen.getByRole('combobox')).toHaveValue('other');
    expect(screen.getByRole('textbox')).toHaveValue('Netrunner');
  });

  it('stays in Other mode with an empty value, then snaps back when a known slug is typed', () => {
    const onChange = vi.fn();
    render(<Harness initial="commander" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('combobox')).toHaveValue('other');
    expect(screen.getByPlaceholderText('FormatPicker.placeholder.dialog')).toHaveValue('');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Legacy' } });
    expect(screen.getByRole('combobox')).toHaveValue('legacy');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('uses the compact labels in the sidebar variant', () => {
    render(<Harness initial="cube" variant="sidebar" />);
    expect(screen.getByRole('option', { name: 'FormatPicker.other.sidebar' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('FormatPicker.placeholder.sidebar')).toHaveValue('cube');
  });
});
