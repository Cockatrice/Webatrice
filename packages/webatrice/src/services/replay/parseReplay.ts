import { fromBinary, isFieldSet } from '@bufbuild/protobuf';
import { BinaryReader, WireType } from '@bufbuild/protobuf/wire';
import { GameEventContainerSchema, GameReplaySchema, type GameReplay } from '@cockatrice/sockatrice/generated';
import i18n from 'i18next';

import type messages from './parseReplay.i18n.json';

export const REPLAY_FILE_EXTENSION = '.cor';
export const MAX_REPLAY_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_REPLAY_EVENT_CONTAINERS = 100_000;
export const MAX_REPLAY_EVENTS = 100_000;

const REASON_KEYS = {
  invalid: 'ReplayParseError.invalid',
  tooLarge: 'ReplayParseError.tooLarge',
  tooManyContainers: 'ReplayParseError.tooManyContainers',
  tooManyEvents: 'ReplayParseError.tooManyEvents',
} as const satisfies Record<keyof typeof messages.ReplayParseError, string>;

export class ReplayParseError extends Error {
  constructor(reason: keyof typeof messages.ReplayParseError, options?: { cause?: unknown }) {
    super(i18n.t(REASON_KEYS[reason]), options);
    this.name = 'ReplayParseError';
  }
}

export function parseReplay(bytes: Uint8Array): GameReplay {
  if (bytes.byteLength > MAX_REPLAY_FILE_BYTES) {
    throw new ReplayParseError('tooLarge');
  }
  let replay: GameReplay;
  try {
    const reader = new BinaryReader(bytes);
    let containers = 0;
    let events = 0;
    while (reader.pos < reader.len) {
      const [field, wireType] = reader.tag();
      if (wireType === WireType.StartGroup || wireType === WireType.EndGroup) {
        throw new ReplayParseError('invalid');
      }
      if (field === GameReplaySchema.field.eventList.number) {
        if (++containers > MAX_REPLAY_EVENT_CONTAINERS) {
          throw new ReplayParseError('tooManyContainers');
        }
        if (wireType !== WireType.LengthDelimited) {
          throw new ReplayParseError('invalid');
        }
        const container = new BinaryReader(reader.bytes());
        while (container.pos < container.len) {
          const [containerField, containerWireType] = container.tag();
          if (containerWireType === WireType.StartGroup || containerWireType === WireType.EndGroup) {
            throw new ReplayParseError('invalid');
          }
          if (containerField === GameEventContainerSchema.field.eventList.number && ++events > MAX_REPLAY_EVENTS) {
            throw new ReplayParseError('tooManyEvents');
          }
          container.skip(containerWireType, containerField);
        }
      } else {
        reader.skip(wireType, field);
      }
    }
    replay = fromBinary(GameReplaySchema, bytes);
  } catch (cause) {
    if (cause instanceof ReplayParseError) {
      throw cause;
    }
    throw new ReplayParseError('invalid', { cause });
  }
  if (!isFieldSet(replay, GameReplaySchema.field.gameInfo) || replay.eventList.length === 0) {
    throw new ReplayParseError('invalid');
  }
  return replay;
}

export function replayFileName(replayId: number | bigint): string {
  return `replay_${replayId}${REPLAY_FILE_EXTENSION}`;
}
