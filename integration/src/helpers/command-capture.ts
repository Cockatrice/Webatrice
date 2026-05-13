import { fromBinary, getExtension, hasExtension } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';

import { AdminCommand, CommandContainer, CommandContainerSchema, GameCommand, ModeratorCommand, RoomCommand, SessionCommand } from 'sockatrice/generated';
import { getMockWebSocket } from './setup';

type SessionCmd = SessionCommand;
type RoomCmd = RoomCommand;
type GameCmd = GameCommand;
type AdminCmd = AdminCommand;
type ModeratorCmd = ModeratorCommand;

export function captureAllOutbound(): CommandContainer[] {
  const mock = getMockWebSocket();
  return mock.send.mock.calls.map(([bytes]: [Uint8Array]) =>
    fromBinary(CommandContainerSchema, bytes)
  );
}

export function captureLastOutbound(): CommandContainer {
  const all = captureAllOutbound();
  if (all.length === 0) {
    throw new Error('No outbound command has been sent through the mock WebSocket.');
  }
  return all[all.length - 1];
}

export function lastCmdId(): number {
  return Number(captureLastOutbound().cmdId);
}

export function findLastSessionCommand<V>(
  ext: GenExtension<SessionCmd, V>
): { container: CommandContainer; value: V; cmdId: number } {
  const containers = captureAllOutbound();
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i];
    for (const sessionCmd of container.sessionCommand ?? []) {
      if (hasExtension(sessionCmd, ext)) {
        return {
          container,
          value: getExtension(sessionCmd, ext),
          cmdId: Number(container.cmdId),
        };
      }
    }
  }
  throw new Error(
    `No outbound session command with extension ${ext.typeName} has been sent.`
  );
}

export function findLastRoomCommand<V>(
  ext: GenExtension<RoomCmd, V>
): { container: CommandContainer; value: V; cmdId: number; roomId: number } {
  const containers = captureAllOutbound();
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i];
    for (const roomCmd of container.roomCommand ?? []) {
      if (hasExtension(roomCmd, ext)) {
        return {
          container,
          value: getExtension(roomCmd, ext),
          cmdId: Number(container.cmdId),
          roomId: container.roomId ?? 0,
        };
      }
    }
  }
  throw new Error(
    `No outbound room command with extension ${ext.typeName} has been sent.`
  );
}

export function findLastGameCommand<V>(
  ext: GenExtension<GameCmd, V>
): { container: CommandContainer; value: V; cmdId: number; gameId: number } {
  const containers = captureAllOutbound();
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i];
    for (const gameCmd of container.gameCommand ?? []) {
      if (hasExtension(gameCmd, ext)) {
        return {
          container,
          value: getExtension(gameCmd, ext),
          cmdId: Number(container.cmdId),
          gameId: container.gameId ?? 0,
        };
      }
    }
  }
  throw new Error(
    `No outbound game command with extension ${ext.typeName} has been sent.`
  );
}

export function findLastAdminCommand<V>(
  ext: GenExtension<AdminCmd, V>
): { container: CommandContainer; value: V; cmdId: number } {
  const containers = captureAllOutbound();
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i];
    for (const adminCmd of container.adminCommand ?? []) {
      if (hasExtension(adminCmd, ext)) {
        return {
          container,
          value: getExtension(adminCmd, ext),
          cmdId: Number(container.cmdId),
        };
      }
    }
  }
  throw new Error(
    `No outbound admin command with extension ${ext.typeName} has been sent.`
  );
}

export function findLastModeratorCommand<V>(
  ext: GenExtension<ModeratorCmd, V>
): { container: CommandContainer; value: V; cmdId: number } {
  const containers = captureAllOutbound();
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i];
    for (const modCmd of container.moderatorCommand ?? []) {
      if (hasExtension(modCmd, ext)) {
        return {
          container,
          value: getExtension(modCmd, ext),
          cmdId: Number(container.cmdId),
        };
      }
    }
  }
  throw new Error(
    `No outbound moderator command with extension ${ext.typeName} has been sent.`
  );
}
