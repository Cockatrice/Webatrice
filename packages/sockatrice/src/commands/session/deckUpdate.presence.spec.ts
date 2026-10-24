
vi.mock('../../WebClient');

import { Mock } from 'vitest';
import { fromBinary, isFieldSet, toBinary } from '@bufbuild/protobuf';

import { WebClient } from '../../WebClient';
import { Command_DeckUploadSchema, type Command_DeckUpload } from '../../generated';
import { deckUpdate } from './deckUpdate';
import { deckUpload } from './deckUpload';
import { CommandFailure } from '../../types/CommandFailure';

function lastSentMessage(): Command_DeckUpload {
  const calls = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls;
  return calls[calls.length - 1][1] as Command_DeckUpload;
}

describe('Command_DeckUpload proto2 presence (update vs create)', () => {
  it('settles the originating request after routing its response to Datatrice', () => {
    const first = vi.fn();
    const second = vi.fn();
    deckUpdate(7, '<first/>', undefined, undefined, first);
    deckUpdate(7, '<second/>', undefined, undefined, second);
    const calls = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls;
    calls.at(-1)![2].onSuccess({});
    expect(second).toHaveBeenCalledWith(null);
    expect(first).not.toHaveBeenCalled();
    expect(WebClient.instance.response.session.updateServerDeck).toHaveBeenCalledWith(7, undefined);
    calls.at(-2)![2].onError(1, {}, CommandFailure.Timeout);
    expect(first).toHaveBeenCalledWith({ responseCode: 1, failure: CommandFailure.Timeout });
    expect(WebClient.instance.response.session.updateServerDeckFailed).toHaveBeenCalledWith(7, 1, CommandFailure.Timeout);
  });

  it('deckUpdate leaves path unset on the wire', () => {
    deckUpdate(7, '<cockatrice_deck/>');

    const parsed = fromBinary(Command_DeckUploadSchema, toBinary(Command_DeckUploadSchema, lastSentMessage()));

    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.path)).toBe(false);
    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.deckId)).toBe(true);
    expect(parsed.deckId).toBe(7);
    expect(parsed.deckList).toBe('<cockatrice_deck/>');
  });

  it('deckUpdate sends the color identity, and leaves visibility unset unless given', () => {
    deckUpdate(7, '<cockatrice_deck/>', undefined, 'UB');

    const parsed = fromBinary(Command_DeckUploadSchema, toBinary(Command_DeckUploadSchema, lastSentMessage()));

    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.colorIdentity)).toBe(true);
    expect(parsed.colorIdentity).toBe('UB');
    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.isPublic)).toBe(false);
    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.path)).toBe(false);
  });

  it('deckUpload marks an empty root path present, so the server creates a deck', () => {
    deckUpload('', 0, '<cockatrice_deck/>');

    const parsed = fromBinary(Command_DeckUploadSchema, toBinary(Command_DeckUploadSchema, lastSentMessage()));

    expect(isFieldSet(parsed, Command_DeckUploadSchema.field.path)).toBe(true);
  });
});
