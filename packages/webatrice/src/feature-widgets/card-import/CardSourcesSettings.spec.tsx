import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ usePictureUrlTemplates: vi.fn() }));

vi.mock('./usePictureUrlTemplates', () => ({ usePictureUrlTemplates: hoisted.usePictureUrlTemplates }));

import CardSourcesSettings from './CardSourcesSettings';

function makeHook(overrides = {}) {
  return {
    loading: false,
    error: null,
    templates: ['https://a/!name!.jpg', 'https://b/!set:uuid!.jpg'],
    selectedIndex: null,
    select: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
    replaceSelected: vi.fn().mockResolvedValue(undefined),
    removeSelected: vi.fn().mockResolvedValue(undefined),
    moveSelected: vi.fn().mockResolvedValue(undefined),
    resetToDefaults: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const urlField = () => screen.getByLabelText('CardSourcesSettings.label.url');

describe('CardSourcesSettings', () => {
  it('lists the templates in priority order', () => {
    hoisted.usePictureUrlTemplates.mockReturnValue(makeHook());
    renderWithProviders(<CardSourcesSettings />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'https://a/!name!.jpg',
      'https://b/!set:uuid!.jpg',
    ]);
    expect(screen.getByRole('button', { name: 'CardSourcesSettings.button.remove' })).toBeDisabled();
  });

  it('selects templates from the keyboard, starting at the selected one', () => {
    const hook = makeHook({ selectedIndex: 1 });
    hoisted.usePictureUrlTemplates.mockReturnValue(hook);
    renderWithProviders(<CardSourcesSettings />);

    const [first, second] = screen.getAllByRole('option');
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
    expect(hook.select).toHaveBeenCalledWith(0);
    fireEvent.keyDown(first, { key: ' ' });
    expect(hook.select).toHaveBeenLastCalledWith(0);
    expect(urlField()).toHaveValue('https://a/!name!.jpg');
  });

  it('adds a valid URL template', async () => {
    const hook = makeHook();
    hoisted.usePictureUrlTemplates.mockReturnValue(hook);
    renderWithProviders(<CardSourcesSettings />);

    fireEvent.change(urlField(), { target: { value: 'https://img.example/!setcode!/!name!.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'CardSourcesSettings.button.add' }));
    await waitFor(() => expect(hook.add).toHaveBeenCalledWith('https://img.example/!setcode!/!name!.jpg'));
  });

  it('rejects something that is not an http(s) URL', async () => {
    const hook = makeHook();
    hoisted.usePictureUrlTemplates.mockReturnValue(hook);
    renderWithProviders(<CardSourcesSettings />);

    fireEvent.change(urlField(), { target: { value: 'not a url' } });
    fireEvent.click(screen.getByRole('button', { name: 'CardSourcesSettings.button.add' }));
    expect(await screen.findByText('CardSourcesSettings.validation.url')).toBeInTheDocument();
    expect(hook.add).not.toHaveBeenCalled();
  });

  it('loads a selected template into the field for editing and moves it', async () => {
    const hook = makeHook({ selectedIndex: 1 });
    hoisted.usePictureUrlTemplates.mockReturnValue(hook);
    renderWithProviders(<CardSourcesSettings />);

    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(hook.select).toHaveBeenCalledWith(1);
    expect(urlField()).toHaveValue('https://b/!set:uuid!.jpg');

    fireEvent.change(urlField(), { target: { value: 'https://c/!name!' } });
    fireEvent.click(screen.getByRole('button', { name: 'CardSourcesSettings.button.edit' }));
    await waitFor(() => expect(hook.replaceSelected).toHaveBeenCalledWith('https://c/!name!'));

    fireEvent.click(screen.getByRole('button', { name: 'CardSourcesSettings.button.up' }));
    expect(hook.moveSelected).toHaveBeenCalledWith(-1);
    expect(screen.getByRole('button', { name: 'CardSourcesSettings.button.down' })).toBeDisabled();
  });

  it('resets the list and confirms it', async () => {
    const hook = makeHook();
    hoisted.usePictureUrlTemplates.mockReturnValue(hook);
    renderWithProviders(<CardSourcesSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'CardSourcesSettings.button.reset' }));
    expect(await screen.findByText('CardSourcesSettings.message.reset')).toBeInTheDocument();
    expect(hook.resetToDefaults).toHaveBeenCalled();
  });
});
