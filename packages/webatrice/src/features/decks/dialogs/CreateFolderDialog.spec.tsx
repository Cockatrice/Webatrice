import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CreateFolderDialog } from './CreateFolderDialog';

function renderDialog(siblings: string[] = ['Cube']) {
  const props = { open: true, parentPath: 'Modern', siblings, onClose: vi.fn(), onCreate: vi.fn() };
  render(<CreateFolderDialog {...props} />);
  return props;
}

function submit(name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'CreateFolder.label' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /CreateFolder.create/ }));
}

describe('CreateFolderDialog', () => {
  it('creates the folder with "/" replaced, like desktop', async () => {
    const props = renderDialog();
    submit(' Old/New ');
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledWith('Old-New'));
  });

  it.each([
    ['', 'CreateFolder.problem.empty'],
    ['Cube', 'CreateFolder.problem.exists'],
    ['x'.repeat(260), 'CreateFolder.problem.tooLong'],
  ])('refuses %j with %s', async (name, message) => {
    const props = renderDialog();
    submit(name);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('closes on cancel', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'CreateFolder.cancel' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
