import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import InputField from './InputField';

describe('InputField', () => {
  const defaultProps = {
    name: 'test',
    value: '',
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    label: 'Test Field',
  };

  it('renders a text field with label', () => {
    render(<InputField {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows error when touched and has error', () => {
    render(<InputField {...defaultProps} touched error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('does not show validation messages when not touched', () => {
    render(<InputField {...defaultProps} touched={false} error="Required" />);
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('reflects parent-driven value updates (controlled mode)', () => {
    const { rerender } = render(<InputField {...defaultProps} value="alpha" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('alpha');

    rerender(<InputField {...defaultProps} value="beta" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('beta');
  });

  it('forwards the typed value through onChange in controlled mode', () => {
    const seenValues: string[] = [];
    const onChange = vi.fn((e) => {
      seenValues.push((e.target as HTMLInputElement).value);
    });
    render(<InputField {...defaultProps} value="seed" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } });

    expect(onChange).toHaveBeenCalled();
    expect(seenValues[0]).toBe('typed');
  });

  it('round-trips keystrokes when wired to local state (host-managed controlled flow)', () => {
    function Host() {
      const [value, setValue] = useState('');
      return (
        <InputField
          label="Host"
          name="host"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'hi' } });
    expect(input.value).toBe('hi');

    fireEvent.change(input, { target: { value: 'hi!' } });
    expect(input.value).toBe('hi!');
  });

  it('renders the validation error icon alongside the error text when touched', () => {
    const { container } = render(
      <InputField {...defaultProps} touched error="Required" />,
    );
    const errorBlock = container.querySelector('.InputField-error');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock?.textContent).toContain('Required');
    expect(errorBlock?.querySelector('svg')).not.toBeNull();
  });

  it('omits validation styling when there is no error, even if touched', () => {
    const { container } = render(<InputField {...defaultProps} touched />);
    expect(container.querySelector('.InputField-validation')).toBeNull();
    expect(container.querySelector('.InputField-error')).toBeNull();
  });

  it('forwards focus/blur callbacks to the underlying input', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <InputField
        {...defaultProps}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
