
vi.mock('../../WebClient');

import { create } from '@bufbuild/protobuf';
import { Mock } from 'vitest';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import {
  Command_Report_ext,
  Command_ReportAddComment_ext,
  Command_ReportDetails_ext,
  Command_ReportMyList_ext,
  Command_SetCardArtParams_ext,
  Response_ReportDetails_ext,
  Response_ReportMyList_ext,
  Response_ResponseCode,
  ServerInfo_ReportSchema,
} from '../../generated';

import { report } from './report';
import { reportAddComment } from './reportAddComment';
import { reportDetails } from './reportDetails';
import { reportMyList } from './reportMyList';
import { setCardArtParams } from './setCardArtParams';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendSessionCommand as Mock,
  2
);

describe('report', () => {
  const params = { reportedUser: 'mallory', category: 'harassment', description: 'rude', gameId: 7, chatLog: 'log' };

  it('sends Command_Report with every report field', () => {
    report(params);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_Report_ext,
      expect.objectContaining(params),
      expect.any(Object)
    );
  });

  it('calls onSubmitted on success', () => {
    const onSubmitted = vi.fn();
    report(params, onSubmitted);
    invokeOnSuccess();
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('passes the rate-limit response code to onFailure', () => {
    const onSubmitted = vi.fn();
    const onFailure = vi.fn();
    report(params, onSubmitted, onFailure);
    invokeOnError(Response_ResponseCode.RespTooManyRequests);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespTooManyRequests, expect.anything());
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('does not throw when no callbacks are supplied', () => {
    report(params);
    expect(() => invokeOnSuccess()).not.toThrow();
  });
});

describe('reportMyList', () => {
  it('sends Command_ReportMyList expecting Response_ReportMyList', () => {
    reportMyList();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReportMyList_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ReportMyList_ext })
    );
  });

  it('forwards the reports to response.session.reportMyList', () => {
    reportMyList();
    const reports = [create(ServerInfo_ReportSchema, { reportId: 3, status: 'pending' })];
    invokeOnSuccess({ reports });
    expect(WebClient.instance.response.session.reportMyList).toHaveBeenCalledWith(reports);
  });
});

describe('reportDetails', () => {
  it('sends Command_ReportDetails with reportId', () => {
    reportDetails(3);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReportDetails_ext,
      expect.objectContaining({ reportId: 3 }),
      expect.objectContaining({ responseExt: Response_ReportDetails_ext })
    );
  });

  it('forwards the report to response.session.reportDetails', () => {
    reportDetails(3);
    const detail = create(ServerInfo_ReportSchema, { reportId: 3 });
    invokeOnSuccess({ report: detail });
    expect(WebClient.instance.response.session.reportDetails).toHaveBeenCalledWith(detail);
  });

  it('drops a success response that carries no report', () => {
    reportDetails(3);
    invokeOnSuccess({});
    expect(WebClient.instance.response.session.reportDetails).not.toHaveBeenCalled();
  });
});

describe('reportAddComment', () => {
  it('sends Command_ReportAddComment with reportId and comment', () => {
    reportAddComment(3, 'more context');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReportAddComment_ext,
      expect.objectContaining({ reportId: 3, comment: 'more context' }),
      expect.any(Object)
    );
  });

  it('reports success and failure to the caller', () => {
    const onAdded = vi.fn();
    const onFailure = vi.fn();
    reportAddComment(3, 'more context', onAdded, onFailure);
    invokeOnSuccess();
    expect(onAdded).toHaveBeenCalled();
    invokeOnError(Response_ResponseCode.RespAccessDenied);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespAccessDenied, expect.anything());
  });
});

describe('setCardArtParams', () => {
  const params = { cardName: 'Island', cardProviderId: 'abc', marginPctL: 0.3, marginPctR: 0.02, verticalOffset: 0.35, zoom: 1 };

  it('sends Command_SetCardArtParams with the art params', () => {
    setCardArtParams(params);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_SetCardArtParams_ext,
      expect.objectContaining(params),
      expect.any(Object)
    );
  });

  it('reports a card-art rule denial to onFailure without touching the response contract', () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    setCardArtParams(params, onSuccess, onFailure);
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespFunctionNotAllowed, expect.anything());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(WebClient.instance.response.session.updateUser).not.toHaveBeenCalled();
  });

  it('calls onSuccess on RespOk', () => {
    const onSuccess = vi.fn();
    setCardArtParams(params, onSuccess);
    invokeOnSuccess();
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('own-report load failures', () => {
  it('reportMyList reports a failure through the session commandFailed', () => {
    reportMyList();
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(WebClient.instance.response.session.commandFailed).toHaveBeenCalledWith(
      'reportMyList', Response_ResponseCode.RespFunctionNotAllowed, '', undefined,
    );
    expect(WebClient.instance.response.session.reportMyList).not.toHaveBeenCalled();
  });

  it('reportDetails reports RespAccessDenied with the report id as the target', () => {
    reportDetails(3);
    invokeOnError(Response_ResponseCode.RespAccessDenied);
    expect(WebClient.instance.response.session.commandFailed).toHaveBeenCalledWith(
      'reportDetails', Response_ResponseCode.RespAccessDenied, '3', undefined,
    );
    expect(WebClient.instance.response.session.reportDetails).not.toHaveBeenCalled();
  });
});
