import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import * as Data from '@cockatrice/sockatrice/generated';
import { useServerReplays } from '../../../../src/features/replays/useServerReplays';
import { renderFeatureScreen } from '../helpers';
import { connectAndLogin } from '../../helpers/setup';
import { findLastSessionCommand } from '../../helpers/command-capture';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../../helpers/protobuf-builders';

function Probe() {
  const model = useServerReplays();
  return <output data-testid="replay-state">{JSON.stringify({
    ids: model.matches.map((m) => m.gameId), loading: model.loading, notice: model.notice,
  })}</output>;
}

function state() {
  return JSON.parse(screen.getByTestId('replay-state').textContent!);
}

function reply(cmdId: number, gameId: number) {
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId,
    responseCode: Data.Response_ResponseCode.RespOk,
    ext: Data.Response_ReplayList_ext,
    value: create(Data.Response_ReplayListSchema, {
      matchList: [create(Data.ServerInfo_ReplayMatchSchema, { gameId })],
    }),
  }))));
}

describe('server replay refresh round trips', () => {
  it.each(['success', 'failure'])('does not settle or alert a new view with an old view %s', (outcome) => {
    connectAndLogin();
    const oldView = renderFeatureScreen(<Probe />);
    const first = findLastSessionCommand(Data.Command_ReplayList_ext);
    oldView.unmount();
    renderFeatureScreen(<Probe />);
    const second = findLastSessionCommand(Data.Command_ReplayList_ext);

    if (outcome === 'success') {
      reply(first.cmdId, 1);
    } else {
      act(() => deliverMessage(buildResponseMessage(buildResponse({
        cmdId: first.cmdId,
        responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
      }))));
    }
    expect(state()).toMatchObject({ loading: true, notice: null });

    reply(second.cmdId, 2);
    expect(state()).toEqual({ ids: [2], loading: false, notice: null });
  });

  it('shows the list from the automatic refresh after a replay grant without match info', () => {
    connectAndLogin();
    renderFeatureScreen(<Probe />);
    reply(findLastSessionCommand(Data.Command_ReplayList_ext).cmdId, 2);

    act(() => deliverMessage(buildSessionEventMessage(
      Data.Event_ReplayAdded_ext, create(Data.Event_ReplayAddedSchema),
    )));
    const automatic = findLastSessionCommand(Data.Command_ReplayList_ext);
    reply(automatic.cmdId, 3);

    expect(findLastSessionCommand(Data.Command_ReplayList_ext).cmdId).toBe(automatic.cmdId);
    expect(state()).toEqual({ ids: [3], loading: false, notice: null });
  });
});
