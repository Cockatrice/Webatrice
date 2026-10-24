import type { GenExtension } from '@bufbuild/protobuf/codegenv2';
import type { Response } from '../generated';
import { Response_ResponseCode, ResponseSchema } from '../generated';
vi.mock('@bufbuild/protobuf', async () => {
  const actual = await vi.importActual<typeof import('@bufbuild/protobuf')>('@bufbuild/protobuf');
  return { ...actual, getExtension: vi.fn() };
});

import { create, getExtension } from '@bufbuild/protobuf';

import { CommandFailure, handleFailure, handleResponse } from './command-options';

describe('handleResponse', () => {
  it('calls onResponse and returns early when provided', () => {
    const onResponse = vi.fn();
    const onSuccess = vi.fn();
    handleResponse('test', create(ResponseSchema, { responseCode: 99 }), { onResponse, onSuccess });
    expect(onResponse).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onSuccess when responseCode is RespOk and no responseExt', () => {
    const onSuccess = vi.fn();
    const raw = create(ResponseSchema, { responseCode: Response_ResponseCode.RespOk });
    handleResponse('test', raw, { onSuccess });
    expect(onSuccess).toHaveBeenCalledWith();
  });

  it('calls onSuccess with nested response when responseExt is set', () => {
    vi.mocked(getExtension).mockReturnValue({ nested: true });
    const onSuccess = vi.fn();
    const fakeExt = {} as unknown as GenExtension<Response, unknown>;
    const raw = create(ResponseSchema, { responseCode: Response_ResponseCode.RespOk });
    handleResponse('test', raw, { onSuccess, responseExt: fakeExt });
    expect(onSuccess).toHaveBeenCalledWith({ nested: true }, raw);
  });

  it('calls onResponseCode handler when code matches', () => {
    const specificHandler = vi.fn();
    handleResponse('test', create(ResponseSchema, { responseCode: 5 }), { onResponseCode: { 5: specificHandler } });
    expect(specificHandler).toHaveBeenCalled();
  });

  it('calls onError when responseCode is not RespOk and no specific handler', () => {
    const onError = vi.fn();
    const raw = create(ResponseSchema, { responseCode: 99 });
    handleResponse('test', raw, { onError });
    expect(onError).toHaveBeenCalledWith(99, raw);
  });

  it('logs error to console when no callbacks for non-RespOk response', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleResponse('test.Type', create(ResponseSchema, { responseCode: 42 }), {});
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('handleFailure', () => {
  it('passes RespNotConnected, a synthesised response and the reason to onError', () => {
    const onError = vi.fn();
    handleFailure('test', CommandFailure.Timeout, { onError }, 7);
    expect(onError).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected,
      expect.objectContaining({ cmdId: 7n, responseCode: Response_ResponseCode.RespNotConnected }),
      CommandFailure.Timeout,
    );
  });

  it('prefers an onResponseCode[RespNotConnected] handler over onError', () => {
    const handler = vi.fn();
    const onError = vi.fn();
    handleFailure('test', CommandFailure.Disconnected, {
      onError,
      onResponseCode: { [Response_ResponseCode.RespNotConnected]: handler },
    });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ responseCode: Response_ResponseCode.RespNotConnected }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('never calls onResponse or onSuccess', () => {
    const onResponse = vi.fn();
    const onSuccess = vi.fn();
    handleFailure('test', CommandFailure.NotSent, { onResponse });
    handleFailure('test', CommandFailure.NotSent, { onSuccess });
    expect(onResponse).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('warns when no handler can take the failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handleFailure('test.Type', CommandFailure.Timeout, { onSuccess: vi.fn() });
    expect(warn).toHaveBeenCalledWith('test.Type failed: timeout');
    warn.mockRestore();
  });

  it('stays quiet for an onResponse-only command (the keepalive ping reports its own health)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handleFailure('test', CommandFailure.Timeout, { onResponse: vi.fn() });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
