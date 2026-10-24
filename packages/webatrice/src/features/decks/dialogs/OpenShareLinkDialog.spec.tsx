import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OpenShareLinkDialog } from './OpenShareLinkDialog';

function renderDialog() {
  const props = { open: true, onClose: vi.fn(), onOpen: vi.fn() };
  render(<OpenShareLinkDialog {...props} />);
  return props;
}

function submit(link: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'OpenShareLink.label' }), { target: { value: link } });
  fireEvent.click(screen.getByRole('button', { name: /OpenShareLink.submit/ }));
}

describe('OpenShareLinkDialog', () => {
  it('opens a desktop link', async () => {
    const props = renderDialog();
    submit('cockatrice://opendeck?share=tok&hostname=server.example&port=4747');
    await waitFor(() => expect(props.onOpen).toHaveBeenCalledWith({ token: 'tok', hostname: 'server.example', port: '4747' }));
  });

  it.each([
    ['nonsense', 'OpenShareLink.problem.invalid'],
    ['https://x/?share=tok&port=1', 'OpenShareLink.problem.hostname'],
    ['https://x/?share=tok&hostname=h', 'OpenShareLink.problem.port'],
    ['https://x/?hostname=h&port=1', 'OpenShareLink.problem.share'],
  ])('refuses %s with desktop\'s message', async (link, message) => {
    const props = renderDialog();
    submit(link);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('closes on cancel', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'OpenShareLink.cancel' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
