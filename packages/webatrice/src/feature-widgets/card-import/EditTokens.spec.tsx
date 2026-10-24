import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useEditTokens: vi.fn() }));

vi.mock('./useEditTokens', () => ({ useEditTokens: hoisted.useEditTokens }));

import { applyTokenData, createCustomToken } from './customTokens';
import EditTokens from './EditTokens';

const spirit = applyTokenData(createCustomToken('Spirit'), { color: 'w', pt: '1/1', annotation: 'Flying' });

function makeHook(overrides = {}) {
  return {
    loading: false,
    error: null,
    tokens: [spirit],
    selected: null,
    select: vi.fn(),
    addToken: vi.fn().mockResolvedValue('added'),
    updateSelected: vi.fn().mockResolvedValue(undefined),
    removeSelected: vi.fn().mockResolvedValue(undefined),
    exportXml: vi.fn(() => '<xml/>'),
    ...overrides,
  };
}

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('EditTokens.label.newName'), { target: { value } });
}

describe('EditTokens', () => {
  it('disables adding tokens until the source has loaded', () => {
    hoisted.useEditTokens.mockReturnValue(makeHook({ loading: true, tokens: [] }));
    renderWithProviders(<EditTokens />);
    expect(screen.getByLabelText('EditTokens.label.newName')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'EditTokens.button.add' })).toBeDisabled();
  });

  it('lists custom tokens and selects one on click', () => {
    const hook = makeHook();
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    fireEvent.click(screen.getByRole('option', { name: 'Spirit' }));
    expect(hook.select).toHaveBeenCalledWith('Spirit');
    expect(screen.getByText('EditTokens.selectHint')).toBeInTheDocument();
  });

  it('moves the selection with the arrow keys and selects with Space or Enter', () => {
    const zombie = createCustomToken('Zombie');
    const hook = makeHook({ tokens: [spirit, zombie] });
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    const [first, second] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    expect(hook.select).toHaveBeenCalledWith('Zombie');

    fireEvent.keyDown(second, { key: 'Home' });
    expect(first).toHaveFocus();
    expect(hook.select).toHaveBeenLastCalledWith('Spirit');
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.keyDown(second, { key: ' ' });
    expect(hook.select.mock.calls.slice(-2)).toEqual([['Spirit'], ['Zombie']]);
  });

  it('adds a token by name', async () => {
    const hook = makeHook();
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    typeName('Angel');
    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.add' }));
    await waitFor(() => expect(hook.addToken).toHaveBeenCalledWith('Angel'));
  });

  it('shows desktop\'s conflict error when the name is taken', async () => {
    hoisted.useEditTokens.mockReturnValue(makeHook({ addToken: vi.fn().mockResolvedValue('conflict') }));
    renderWithProviders(<EditTokens />);

    typeName('Lightning Bolt');
    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.add' }));
    expect(await screen.findByText('EditTokens.validation.conflict')).toBeInTheDocument();
  });

  it('requires a name', async () => {
    const hook = makeHook();
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.add' }));
    expect(await screen.findByText('Common.validation.required')).toBeInTheDocument();
    expect(hook.addToken).not.toHaveBeenCalled();
  });

  it('edits the selected token\'s P/T and removes it', async () => {
    const hook = makeHook({ selected: spirit });
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    expect(screen.getByLabelText('P/T')).toHaveValue('1/1');
    fireEvent.change(screen.getByLabelText('P/T'), { target: { value: '2/2' } });
    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.apply' }));
    await waitFor(() => expect(hook.updateSelected).toHaveBeenCalledWith(
      { color: 'w', pt: '2/2', annotation: 'Flying' },
      expect.anything(),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.remove' }));
    expect(hook.removeSelected).toHaveBeenCalled();
  });

  it('exports TK.xml', () => {
    const createObjectURL = vi.fn(() => 'blob:tk');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const attached: boolean[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClick(this: HTMLAnchorElement) {
      attached.push(this.isConnected);
    });
    vi.useFakeTimers();
    const hook = makeHook();
    hoisted.useEditTokens.mockReturnValue(hook);
    renderWithProviders(<EditTokens />);

    fireEvent.click(screen.getByRole('button', { name: 'EditTokens.button.export' }));
    expect(hook.exportXml).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(attached).toEqual([true]);
    expect(document.querySelector('a[download="TK.xml"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:tk');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
