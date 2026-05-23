import { useState } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import SelectField, { type SelectFieldOption } from './SelectField';

const options: SelectFieldOption<string>[] = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

describe('SelectField', () => {
  it('renders the label and the currently selected option', () => {
    renderWithProviders(
      <SelectField
        label="Color"
        value="green"
        onChange={() => {}}
        options={options}
      />,
    );

    expect(screen.getByLabelText('Color')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Green');
  });

  it('opens a listbox of options when the trigger is clicked', () => {
    renderWithProviders(
      <SelectField
        label="Color"
        value="red"
        onChange={() => {}}
        options={options}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));

    const listbox = screen.getByRole('listbox');
    const items = within(listbox).getAllByRole('option');
    expect(items.map((item) => item.textContent)).toEqual(['Red', 'Green', 'Blue']);
  });

  it('fires onChange with the chosen option value (controlled mode)', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SelectField
        label="Color"
        value="red"
        onChange={onChange}
        options={options}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Blue'));

    expect(onChange).toHaveBeenCalled();
    const ev = onChange.mock.calls[0][0];
    expect(ev.target.value).toBe('blue');
  });

  it('round-trips selection through a host-managed value (host-managed controlled flow)', () => {
    function Host() {
      const [value, setValue] = useState<string>('red');
      return (
        <SelectField
          label="Color"
          value={value}
          onChange={(e) => setValue(String(e.target.value))}
          options={options}
        />
      );
    }

    renderWithProviders(<Host />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Red');

    fireEvent.mouseDown(trigger);
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Green'));

    expect(screen.getByRole('combobox')).toHaveTextContent('Green');
  });

  it('reflects parent-driven value changes without user interaction', () => {
    const { rerender } = renderWithProviders(
      <SelectField
        label="Color"
        value="red"
        onChange={() => {}}
        options={options}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Red');

    rerender(
      <SelectField
        label="Color"
        value="blue"
        onChange={() => {}}
        options={options}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Blue');
  });

  it('forwards onBlur from the underlying select', () => {
    const onBlur = vi.fn();
    renderWithProviders(
      <SelectField
        label="Color"
        value="red"
        onChange={() => {}}
        onBlur={onBlur}
        options={options}
      />,
    );

    fireEvent.blur(screen.getByRole('combobox'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('supports numeric option values', () => {
    const numericOptions: SelectFieldOption<number>[] = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ];
    const onChange = vi.fn();

    renderWithProviders(
      <SelectField<number>
        label="Count"
        value={1}
        onChange={onChange}
        options={numericOptions}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Two'));

    expect(onChange).toHaveBeenCalled();
    const ev = onChange.mock.calls[0][0];
    expect(Number(ev.target.value)).toBe(2);
  });
});
