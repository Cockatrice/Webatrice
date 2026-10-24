import { act, fireEvent, screen } from '@testing-library/react';
import { rooms, server } from '@cockatrice/datatrice';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import CommandFailureNotices from './CommandFailureNotices';

function setup() {
  return renderWithProviders(<CommandFailureNotices />, { preloadedState: connectedState });
}

describe('CommandFailureNotices', () => {
  it('renders nothing until a command fails', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retains queued notices and disconnect failures until dismissed', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(rooms.Actions.createGameFailed({ roomId: 1, responseCode: Response_ResponseCode.RespContextError }));
      store.dispatch(server.Actions.deckUploadFailed({ path: '', responseCode: Response_ResponseCode.RespContextError }));
    });
    expect(screen.getByText('CommandFailureNotices.createGame.title')).toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
      store.dispatch(server.Actions.deckUploadFailed({
        path: '',
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Disconnected,
      }));
    });
    expect(screen.getByText('CommandFailureNotices.createGame.title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('CommandFailureNotices.deckUpload.serverError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));

    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains a create-game timeout with the transport reason', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(rooms.Actions.createGameFailed({
        roomId: 1,
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(screen.getByText('CommandFailureNotices.createGame.title')).toBeInTheDocument();
    expect(screen.getByText('CommandFailure.timeout')).toBeInTheDocument();
  });

  it('shows desktop\'s "Server error." for a create-game rejection', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(rooms.Actions.createGameFailed({ roomId: 1, responseCode: Response_ResponseCode.RespContextError }));
    });
    expect(screen.getByText('CommandFailureNotices.createGame.serverError')).toBeInTheDocument();
  });

  it('reports deck upload failures, with the transport reason when the server never answered', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.deckUploadFailed({ path: '', responseCode: Response_ResponseCode.RespContextError }));
    });
    expect(screen.getByText('CommandFailureNotices.deckUpload.serverError')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    act(() => {
      store.dispatch(server.Actions.deckUploadFailed({
        path: '',
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Disconnected,
      }));
    });
    expect(screen.getByText('CommandFailureNotices.deckUpload.title')).toBeInTheDocument();
    expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
  });

  it('queues failures and shows them one at a time', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(rooms.Actions.createGameFailed({ roomId: 1, responseCode: Response_ResponseCode.RespContextError }));
      store.dispatch(server.Actions.deckUploadFailed({ path: '', responseCode: Response_ResponseCode.RespContextError }));
    });
    expect(screen.getByText('CommandFailureNotices.createGame.title')).toBeInTheDocument();
    expect(screen.queryByText('CommandFailureNotices.deckUpload.title')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('CommandFailureNotices.deckUpload.title')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
