import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@app/services', () => ({
  CardDTO: { get: vi.fn() },
  TokenDTO: { get: vi.fn() },
}));
vi.mock('../TokenDetails/TokenDetails', () => ({
  default: ({ token }: { token: { name: { value: string } } }) => <div data-testid="preview">{token.name.value}</div>,
}));

import { CardDTO, TokenDTO } from '@app/services';
import CardCallout from './CardCallout';

const SAPROLING = {
  name: { value: 'Saproling' },
  prop: { value: { type: { value: 'Token Creature — Saproling' }, pt: { value: '1/1' } } },
};

async function renderCallout(token: object = SAPROLING) {
  vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
  vi.mocked(TokenDTO.get).mockResolvedValue(token as never);
  render(<CardCallout name="Saproling" />);
  await act(async () => {});
  return screen.getByRole('button', { name: 'Saproling' });
}

describe('CardCallout', () => {
  it('previews the card while the name has keyboard focus', async () => {
    const name = await renderCallout();

    act(() => name.focus());
    expect(screen.getByTestId('preview')).toBeInTheDocument();

    act(() => name.blur());
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  });

  it('describes the focused name with the card\'s type line and P/T', async () => {
    const name = await renderCallout();

    act(() => name.focus());

    expect(name).toHaveAccessibleDescription('Token Creature — Saproling, 1/1');
  });

  it('adds no description when the card has no type line or P/T', async () => {
    const name = await renderCallout({ name: { value: 'Saproling' } });

    act(() => name.focus());

    expect(name).not.toHaveAttribute('aria-describedby');
  });

  it('hides the preview on Escape without moving focus', async () => {
    const name = await renderCallout();
    act(() => name.focus());

    fireEvent.keyDown(name, { key: 'Escape' });

    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    expect(name).toHaveFocus();
  });

  it('still previews on hover', async () => {
    const name = await renderCallout();

    fireEvent.mouseEnter(name);
    expect(screen.getByTestId('preview')).toBeInTheDocument();

    fireEvent.mouseLeave(name);
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  });
});
