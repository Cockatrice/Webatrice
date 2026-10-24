import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import { GameLinkButton, renderGameLinks } from './GameLinkButton';
import { clearGameLinkRequest, useGameLinkRequest } from './gameLinkRequests';

const LINK = 'cockatrice://joingame?hostname=h&port=4747&roomid=1&gameid=7&game=Modern';

function RequestProbe() {
  const request = useGameLinkRequest();
  return <div data-testid="request">{request?.url ?? ''}</div>;
}

describe('renderGameLinks', () => {
  it('returns plain text untouched', () => {
    expect(renderGameLinks('no links here')).toEqual(['no links here']);
  });

  it('turns each link into a button and keeps the surrounding text', () => {
    renderWithProviders(<p>{renderGameLinks(`Join my game "Modern" (#7): ${LINK} see you`)}</p>);
    expect(screen.getByRole('button')).toHaveAttribute('title', LINK);
    expect(screen.getByText(/Join my game "Modern" \(#7\):/)).toBeInTheDocument();
    expect(screen.getByText(/see you/)).toBeInTheDocument();
  });
});

describe('GameLinkButton', () => {
  afterEach(() => clearGameLinkRequest());

  it('labels the link like desktop and hands it to the join host on click', () => {
    renderWithProviders(
      <>
        <GameLinkButton url={LINK} />
        <RequestProbe />
      </>,
    );
    const button = screen.getByRole('button', { name: /GameLink\.anchor\.withDescription/ });
    fireEvent.click(button);
    expect(screen.getByTestId('request')).toHaveTextContent(LINK);
  });

  it('falls back to the plain label for a link without a game id', () => {
    renderWithProviders(<GameLinkButton url="cockatrice://joingame?hostname=h" />);
    expect(screen.getByRole('button', { name: /GameLink\.anchor\.plain/ })).toBeInTheDocument();
  });
});
