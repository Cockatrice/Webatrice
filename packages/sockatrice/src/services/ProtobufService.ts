import { create, fromBinary, hasExtension, getExtension, setExtension, toBinary } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';

import {
  Command_Judge_ext,
  Command_JudgeSchema,
  CommandContainerSchema,
  GameCommandSchema,
  SessionCommandSchema,
  RoomCommandSchema,
  ModeratorCommandSchema,
  AdminCommandSchema,
  ServerMessageSchema,
  ServerMessage_MessageType,
  type Response,
  type CommandContainer,
  type GameCommand,
  type SessionCommand,
  type RoomCommand,
  type ModeratorCommand,
  type AdminCommand,
  type ServerMessage,
  type GameEventContainer,
  type SessionEvent,
  type RoomEvent,
} from '../generated';

import type { GameExtensionRegistry } from '../events/game';
import type { RoomExtensionRegistry } from '../events/room';
import type { SessionExtensionRegistry } from '../events/session';
import type { GameEventMeta } from '../types/WebSocketConfig';
import { type CommandOptions, handleResponse } from './command-options';

export interface SocketTransport {
  send(data: Uint8Array): void;
  isOpen(): boolean;
}

export interface EventRegistries {
  game: GameExtensionRegistry;
  room: RoomExtensionRegistry;
  session: SessionExtensionRegistry;
}

// One game command in a batch. `judgeTargetId` undefined sends it bare; when set,
// the command nests inside a Command_Judge for that owner (entries sharing a
// target are grouped into a single judge wrapper). See sendGameCommands.
export interface GameCommandEntry<V = unknown> {
  ext: GenExtension<GameCommand, V>;
  value: V;
  judgeTargetId?: number;
}

export class ProtobufService {
  private cmdId = 0;
  private pendingCommands = new Map<number, (response: Response) => void>();

  constructor(
    private transport: SocketTransport,
    private events: EventRegistries,
  ) {}

  public resetCommands() {
    this.cmdId = 0;
    this.pendingCommands.clear();
  }

  public sendGameCommand<V, R = unknown>(
    gameId: number,
    ext: GenExtension<GameCommand, V>,
    value: V,
    options?: CommandOptions<R>
  ): void {
    this.sendGameCommands(gameId, [{ ext, value, judgeTargetId: options?.judgeTargetId }], options);
  }

  // Sends many game commands in ONE CommandContainer (one cmd_id, one server
  // response), mirroring Cockatrice's prepareGameCommand(commandList). Bare
  // entries ride directly in the container; judge-targeted entries are grouped
  // by target into one Command_Judge wrapper each (its game_command field is
  // repeated). Used for bulk card actions on a multi-selection.
  public sendGameCommands<R = unknown>(
    gameId: number,
    entries: ReadonlyArray<GameCommandEntry>,
    options?: CommandOptions<R>
  ): void {
    if (entries.length === 0) {
      return;
    }

    const gameCommand = this.createGameCommands(entries);

    // A single bare command keeps its own type name (legacy single-command
    // callers); anything batched is labelled generically for response logging.
    const typeName = entries.length === 1 && entries[0].judgeTargetId === undefined
      ? entries[0].ext.typeName
      : 'GameCommand[batch]';

    const cmd = create(CommandContainerSchema, { gameId, gameCommand });
    this.dispatchCommand(typeName, cmd, options);
  }

  // Builds the top-level GameCommand[] for a CommandContainer: bare entries ride
  // directly; judge-targeted entries are grouped by target into one Command_Judge
  // wrapper each. Mirrors Cockatrice's prepareGameCommand(commandList).
  private createGameCommands(entries: ReadonlyArray<GameCommandEntry>): GameCommand[] {
    const gameCommand: GameCommand[] = [];
    const judgeGroups = new Map<number, GameCommand[]>();

    for (const entry of entries) {
      const gameCmd = create(GameCommandSchema);
      setExtension(gameCmd, entry.ext, entry.value);
      if (entry.judgeTargetId === undefined) {
        gameCommand.push(gameCmd);
      } else {
        const group = judgeGroups.get(entry.judgeTargetId);
        if (group) {
          group.push(gameCmd);
        } else {
          judgeGroups.set(entry.judgeTargetId, [gameCmd]);
        }
      }
    }

    for (const [targetId, cmds] of judgeGroups) {
      gameCommand.push(this.createJudgeCommand(targetId, cmds));
    }
    return gameCommand;
  }

  // Nests a list of game commands under a Command_Judge so the server runs them
  // as targetId. Command_Judge.game_command is repeated, so one wrapper carries
  // every command for that owner.
  private createJudgeCommand(targetId: number, gameCommands: GameCommand[]): GameCommand {
    const judgeCmd = create(GameCommandSchema);
    setExtension(judgeCmd, Command_Judge_ext, create(Command_JudgeSchema, {
      targetId, gameCommand: gameCommands,
    }));
    return judgeCmd;
  }

  public sendRoomCommand<V, R = unknown>(
    roomId: number,
    ext: GenExtension<RoomCommand, V>,
    value: V,
    options?: CommandOptions<R>
  ): void {
    const roomCmd = create(RoomCommandSchema);
    setExtension(roomCmd, ext, value);
    const cmd = create(CommandContainerSchema, { roomId, roomCommand: [roomCmd] });
    this.dispatchCommand(ext.typeName, cmd, options);
  }

  public sendSessionCommand<V, R = unknown>(
    ext: GenExtension<SessionCommand, V>,
    value: V,
    options?: CommandOptions<R>
  ): void {
    const sesCmd = create(SessionCommandSchema);
    setExtension(sesCmd, ext, value);
    const cmd = create(CommandContainerSchema, { sessionCommand: [sesCmd] });
    this.dispatchCommand(ext.typeName, cmd, options);
  }

  public sendModeratorCommand<V, R = unknown>(
    ext: GenExtension<ModeratorCommand, V>,
    value: V,
    options?: CommandOptions<R>
  ): void {
    const modCmd = create(ModeratorCommandSchema);
    setExtension(modCmd, ext, value);
    const cmd = create(CommandContainerSchema, { moderatorCommand: [modCmd] });
    this.dispatchCommand(ext.typeName, cmd, options);
  }

  public sendAdminCommand<V, R = unknown>(
    ext: GenExtension<AdminCommand, V>,
    value: V,
    options?: CommandOptions<R>
  ): void {
    const adminCmd = create(AdminCommandSchema);
    setExtension(adminCmd, ext, value);
    const cmd = create(CommandContainerSchema, { adminCommand: [adminCmd] });
    this.dispatchCommand(ext.typeName, cmd, options);
  }

  private dispatchCommand<R>(typeName: string, cmd: CommandContainer, options?: CommandOptions<R>): void {
    const sent = this.sendCommand(cmd, raw => {
      if (options) {
        handleResponse(typeName, raw, options);
      }
    });

    if (!sent) {
      options?.onError?.(-1, {} as Response);
    }
  }

  public sendCommand(cmd: CommandContainer, callback: (raw: Response) => void): boolean {
    if (!this.transport.isOpen()) {
      return false;
    }

    this.cmdId++;
    cmd.cmdId = BigInt(this.cmdId);
    this.pendingCommands.set(this.cmdId, callback);
    this.transport.send(toBinary(CommandContainerSchema, cmd));
    return true;
  }

  public handleMessageEvent({ data }: MessageEvent): void {
    try {
      const uint8msg = new Uint8Array(data);
      const msg: ServerMessage = fromBinary(ServerMessageSchema, uint8msg);

      if (msg) {
        switch (msg.messageType) {
          case ServerMessage_MessageType.RESPONSE:
            this.processServerResponse(msg.response);
            break;
          case ServerMessage_MessageType.ROOM_EVENT:
            this.processRoomEvent(msg.roomEvent);
            break;
          case ServerMessage_MessageType.SESSION_EVENT:
            this.processSessionEvent(msg.sessionEvent);
            break;
          case ServerMessage_MessageType.GAME_EVENT_CONTAINER:
            this.processGameEvent(msg.gameEventContainer);
            break;
          default:
            console.warn('Unknown message type:', msg);
            break;
        }
      }
    } catch (err) {
      console.error('Processing failed:', err);
    }
  }

  private processServerResponse(response: Response | undefined) {
    if (!response) {
      return;
    }
    const cmdId = Number(response.cmdId);

    if (this.pendingCommands.has(cmdId)) {
      this.pendingCommands.get(cmdId)!(response);
      this.pendingCommands.delete(cmdId);
    }
  }

  private processRoomEvent(event: RoomEvent | undefined) {
    if (!event) {
      return;
    }
    for (const [ext, handler] of this.events.room) {
      if (hasExtension(event, ext)) {
        handler(getExtension(event, ext), event);
        return;
      }
    }
  }

  private processSessionEvent(event: SessionEvent | undefined) {
    if (!event) {
      return;
    }
    for (const [ext, handler] of this.events.session) {
      if (hasExtension(event, ext)) {
        handler(getExtension(event, ext), undefined);
        return;
      }
    }
  }

  private processGameEvent(container: GameEventContainer | undefined): void {
    if (!container?.eventList?.length) {
      return;
    }

    const { gameId, context, secondsElapsed, forcedByJudge } = container;

    for (const event of container.eventList) {
      const meta: GameEventMeta = {
        gameId: gameId ?? -1,
        playerId: event.playerId ?? -1,
        context,
        secondsElapsed: secondsElapsed ?? 0,
        forcedByJudge: forcedByJudge ?? 0,
      };

      for (const [ext, handler] of this.events.game) {
        if (hasExtension(event, ext)) {
          handler(getExtension(event, ext), meta);
          break;
        }
      }
    }
  }
}
