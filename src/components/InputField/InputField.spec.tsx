import { render, screen } from '@testing-library/react';
import InputField from './InputField';

describe('InputField', () => {
  const defaultProps = {
    input: { name: 'test', value: '', onChange: vi.fn(), onBlur: vi.fn(), onFocus: vi.fn() },
    meta: { touched: false, error: null },
    label: 'Test Field',
  };

  it('renders a text field with label', () => {
    render(<InputField {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows error when touched and has error', () => {
    render(<InputField {...defaultProps} meta={{ touched: true, error: 'Required' }} />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('does not show validation messages when not touched', () => {
    render(<InputField {...defaultProps} meta={{ touched: false, error: 'Required' }} />);
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });
});
